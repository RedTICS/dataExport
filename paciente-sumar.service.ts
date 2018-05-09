import * as http from 'http';
import * as sql from 'mssql';
import * as configPrivate from './config.private';

import * as moment from 'moment';

const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;

const url = configPrivate.mongoDB.host;

/* Exportar pacientes a ANSES*/
/* TODO: Tarda demasiado, probar de hacer un SP en SQL Server*/
export async function exportarPacientesAnses() {
    const query_limit = 1000000;

    var connection = {
        user: configPrivate.authSql.user,
        password: configPrivate.authSql.password,
        server: configPrivate.serverSql.server,
        database: configPrivate.serverSql.database,
        requestTimeout: 1900000,
        stream: true
    };

    const coleccion = configPrivate.mongoDB.collection;
    let pool = await new sql.ConnectionPool(connection).connect();

    MongoClient.connect(url, async function (err: any, dbMongo: any) {
        if (err) {
            console.log('Error conectando a mongoClient', err);
            dbMongo.close();
        }
        console.log("Exportando a ANSES...")
        let cursor = dbMongo.collection(coleccion).aggregate([
            {
                $match: { cuil: { $ne: '', $exists: true } }
            },
            { $project: { cuil: 1, documento: 1, fechaNacimiento: 1, nombreCompleto: 1 } },
            {
                $limit: query_limit
            }
        ], {
                cursor: {
                    batchSize: 1
                }
            });

        let cursorArray = cursor.toArray();
        let x = 0;
        let i = 100;
        let total = 0;

        let menores = 0;
        let mayores = 0;
        let cantPrestaciones = 0;

        let listaPacienteAnses: any = [];
        let listaDni: any = [];

        await cursorArray.then(async pacientesCuil => {
            console.log("Cant Pacientes: ", pacientesCuil.length)

            for (let z = 0; z < pacientesCuil.length; z++) {

                let fechaNac = (pacientesCuil[z].fechaNacimiento) ? pacientesCuil[z].fechaNacimiento : '';

                let edad = await getEdadPaciente(fechaNac);
                listaDni.push(pacientesCuil[z].documento);
                
                if (edad <= 18) {
                    menores++;

                    let prestaciones: any = await getNomivacExcel(pacientesCuil[z], pool);
                    prestaciones = prestaciones.recordset;

                    if (prestaciones.length > 0) {
                        let pacienteAnses: any = {};

                        pacienteAnses['cuil'] = pacientesCuil[z].cuil;
                        pacienteAnses['documento'] = pacientesCuil[z].documento;
                        pacienteAnses['cuie'] = prestaciones[0].Cuie;
                        pacienteAnses['establecimiento'] = prestaciones[0].Efector;
                        pacienteAnses['fechaControl'] = prestaciones[0].Fecha;
                        pacienteAnses['discapacitado'] = '  ';
                        pacienteAnses['esquema'] = 'EN';
                        pacienteAnses['codigoEstablecimiento'] = (prestaciones[0].CodigoEstablecimiento) ? prestaciones[0].CodigoEstablecimiento : ''; //(vacunas) ? vacunas[0].CodEstablecimiento : '';
                        pacienteAnses['Establecimiento'] = (prestaciones[0].Establecimiento) ? prestaciones[0].Establecimiento : ' ';// (vacunas) ? vacunas[0].NombreEstablecimiento : '';
                        pacienteAnses['fechaAplicacion'] = (prestaciones[0].fechaAplicacion) ? prestaciones[0].fechaAplicacion : '';//(vacunas) ? vacunas[0].FechaAplicacion : '';
                        pacienteAnses['dependencia'] = '        ';
                        pacienteAnses['sumar'] = prestaciones[0].sumar;
                        
                        listaPacienteAnses.push(pacienteAnses);                        
                    }
                } else {
                    mayores++;
                }
            }
        });

        await procesarDatosAnses(listaPacienteAnses);
        pool.close();

        console.log("Menores: ", menores);
        console.log("Mayores: ", mayores);

    });
}

async function procesarDatosAnses(data) {
    let writer = fs.createWriteStream('pacientes_anses.txt', {
        flags: 'a' // 'a' means appending (old data will be preserved)
    });

    data.forEach(x => {
        let cuil = x.cuil;
        let documento = x.documento;
        let sumar = x.sumar;
        let sisa = ' '.repeat(15);
        let cuie = x.cuie + ' '.repeat(9 - x.cuie.length);
        let establecimiento = (x.establecimiento.length <= 35) ? x.establecimiento + ' '.repeat(35 - x.establecimiento.length) : x.establecimiento.substring(0, 35);
        let discapacitado = x.discapacitado;
        let fechaControl = moment(x.fechaControl).format("YYYYMMDD");
        let esquema = x.esquema;
        let codigoEstablecimiento = (x.codigoEstablecimiento) ? x.codigoEstablecimiento.substring(0, 9) : '';
        let nombreEstablecimiento = (x.Establecimiento.length <= 35) ? x.Establecimiento + ' '.repeat(35 - x.Establecimiento.length) : x.Establecimiento.substring(0, 35);
        let fechaAplicacion = (x.fechaAplicacion) ? moment(x.fechaAplicacion).format("YYYYMMDD") : '';
        let dependencia = x.dependencia;
        let relleno = ' '.repeat(156);

        writer.write(cuil + sumar + sisa + cuie + establecimiento + discapacitado + fechaControl + esquema + codigoEstablecimiento + nombreEstablecimiento + fechaAplicacion + dependencia + relleno);
        writer.write('\n');
    });
}

async function getNomivacExcel(pacientesCuil, pool) {
    let sQuery = " SELECT TOP 1 p.numeroDocumento, n.Establecimiento, n.[Código de establecimiento]AS CodigoEstablecimiento, n.[Fecha de aplicación] AS fechaAplicacion, p.nombre, p.apellido, e.nombre as Efector, c.fecha as Fecha, p.fechaNacimiento as FechaNacimiento, e.cuie as Cuie, "
        + " CASE WHEN a.activo = 'S' AND a.aficlasedoc = 'P' "
        + "          THEN 'SI' "
        + "       ELSE 'NO' "
        + " END AS sumar "
        + " FROM dbo.Sys_Paciente p "
        + " LEFT JOIN dbo.CON_Consulta c ON c.idPaciente = p.idPaciente "
        + " LEFT JOIN dbo.NomivacExcel n ON n.[Nro# de documento] = p.numeroDocumento "
        + " LEFT JOIN dbo.PN_smiafiliados a ON a.afidni = CONVERT(VARCHAR(10), p.numeroDocumento) "
        + " LEFT JOIN dbo.PN_comprobante com ON com.id_smiafiliados = a.id_smiafiliados "
        + " INNER JOIN dbo.Sys_Efector e ON e.idEfector = c.idEfector "
        + " WHERE p.numeroDocumento = '" + pacientesCuil.documento + "'";

    return await pool.request()
        .query(sQuery);
}

async function getEdadPaciente(fechaNacimiento: string) {
    return new Promise((resolve: any, reject: any) => {
        let edad = moment().diff(fechaNacimiento, 'years');

        resolve(edad)
    });
}