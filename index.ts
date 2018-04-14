import * as configPrivate from './config.private';
import { resolve } from 'path';
import { PacienteMpi } from './paciente.service';
import { PacienteSumar } from './paciente-sumar.service';
import * as sql from 'mssql';
import * as moment from 'moment';

var async = require('async');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;

const chalk = require('chalk');
const clear = require('clear');
const figlet = require('figlet');
let inquirer = require('inquirer');

const url = configPrivate.mongoDB.host;
const coleccion = configPrivate.mongoDB.collection;
const directory = 'export/PacientesCuilificados';


inicio();

function inicio() {
    clear();
    let arrayFiles: String[] = [];

    console.log(
        chalk.red.bold(
            figlet.textSync('Rayo Cuilificador', {
                horizontalLayout: 'full'
            })
        )
    );

    const questions = [{
        name: 'cuilificar',
        type: 'rawlist',
        message: 'Seleccione una opción: ',
        choices: [{
            key: "1",
            name: "Importar Pacientes cuilificados",
            value: "importar"
        },
        {
            key: "2",
            name: "Exportar Pacientes para cuilificar de mongodb a un archivo intermedio exportPatient.txt",
            value: "exportar"
        },
        {
            key: "3",
            name: "Exportar pacientes Anses",
            value: "exportar_anses"
        },
        {
            key: "4",
            name: "Ninguna",
            value: "ninguna"
        }
        ],
        validate: function (value: any) {
            if (value.length) {
                return true;
            } else {
                return 'Debe seleccionar una opción';
            }
        }
    }];

    inquirer.prompt(questions).then(answers => {
        if (answers.cuilificar === 'importar') {
            readFilesfromFS()
                .then(function (files: any) {
                    if (files.length) {
                        let menu = [{
                            name: 'archivoElegido',
                            type: 'list',
                            message: 'Seleccionar el archivo a procesar:',
                            choices: files,
                            validate: function (value: any) {
                                if (value.length) {
                                    return true
                                } else {
                                    return 'Debe seleccionar al menos un archivo';
                                }
                            }
                        }]
                        inquirer.prompt(menu)
                            .then(fileSelected => {
                                console.log('Inicio parseo... con archivo seleccionado: ', fileSelected.archivoElegido);
                                importarPacientesCuilificados(fileSelected.archivoElegido)
                                    .then(function (resultado) {
                                        return true;
                                    })
                                    .catch(function (err) {
                                        console.log('err: ', err)
                                    })
                            })
                    }
                })

        } else if (answers.cuilificar === 'exportar') {
            exportPacientes();
        } else if (answers.cuilificar === 'exportar_anses') {
            exportarPacientesAnses();
        } else {
            console.log("Saliendo...");
        }
    });

    function readFilesfromFS() {
        return new Promise((resolve, reject) => {
            let count = 1;
            let archivos: any[] = []
            fs.readdir(directory, function (err, files) {
                if (err) {
                    return reject(err);
                }
                files.forEach(f => {
                    let elem = {
                        key: count,
                        name: f.toString(),
                        value: f.toString()
                    }
                    count++;
                    archivos.push(elem);
                });
                return resolve(archivos);
            })
        })
    };

}


async function importarPacientesCuilificados(arch: any) {
    return new Promise((resolve, reject) => {
        let pathFile = directory + '/' + arch;
        fs.exists(pathFile, function (exists) {
            if (exists) {
                fs.readFile(pathFile, {
                    encoding: "utf8"
                }, function (err, data) {
                    if (err) {
                        reject(err)
                    }
                    let pacientesCuilificados: any[] = data;
                    // procesarDatos(pacientesCuilificados)

                    guardaSipsCuilificado(pacientesCuilificados);
                    resolve(true);
                })
            }
        });
    })
}

async function guardaSipsCuilificado(data) {

    let remaining = '';
    remaining += data;
    let index = remaining.indexOf('\n');
    let x = 0;
    let pacCuil: any = [];
    let pepe: any;

    while (index > -1) {
        let linea = remaining.substring(0, index);
        console.log(linea);
        x++;
        console.log("Total: ", x)
        // for (let i = 0; i < data.length; i++) {
        let nombreCompleto = linea.substring(10, 49);
        let dni = linea.substring(2, 10);
        let sexo = linea.substring(50, 51);
        let cuil = linea.substring(149, 160);
        let fechaNacimiento = linea.substring(51, 59);

        pepe = {
            nombreCompleto: nombreCompleto,
            documento: dni,
            sexo: sexo,
            cuil: cuil,
            fechaNacimiento: fechaNacimiento
        }

        // pacCuil.push(pepe)
        pacCuil.push(pepe);

        remaining = remaining.substring(index + 1);
        index = remaining.indexOf('\n');
    }
    // var entries = [];

    var total_entries = pacCuil.length;

    MongoClient.connect(url, function (err, db) {
        // Get the collection
        var col = db.collection('sipsCuilificado');
        //

        var bulk = col.initializeOrderedBulkOp();
        var counter = 0;

        for (let i = 0; i < pacCuil.length; i++) {
            bulk.insert(pacCuil[i]);


        }

        bulk.execute(function (err, result) {
            console.dir(err);
            console.dir(result);
            db.close();
        });


        // async.whilst(
        //     // Iterator condition
        //     function () { return counter <= total_entries },

        //     // Do this in the iterator
        //     function (callback) {
        //         counter++;

        //         bulk.insert(pacCuil[counter]);

        //         // console.log("Insertado: ", pacCuil[counter]);

        //         // if (counter % 1000 == 0) {
        //             bulk.execute(function (err, result) {
        //                 console.log("Entrando a cero");
        //                 bulk = col.initializeOrderedBulkOp();
        //                 callback(err);
        //             });
        //         // // } else {
        //         //     callback();
        //         // }
        //     },

        //     // When all is done
        //     function (err) {
        //         // if (counter % 1000 != 0)
        //             bulk.execute(function (err, result) {
        //                 console.log("inserted some more");
        //             });
        //         console.log("I'm finished now");
        //         db.close();
        //     }
        // );
    });

    console.log("Cat pepe: ", pacCuil.length);
}

async function procesarDatos(data) {
    let remaining = '';
    remaining += data;
    let index = remaining.indexOf('\n');
    while (index > -1) {
        let linea = remaining.substring(0, index);
        console.log(linea);
        await func(linea);
        remaining = remaining.substring(index + 1);
        index = remaining.indexOf('\n');
    }
    function func(data) {
        return new Promise((resolve, reject) => {
            let nombreCompleto = data.substring(10, 49);
            let dni = data.substring(2, 10);
            let sexo = data.substring(50, 51);
            let cuil = data.substring(149, 160);
            MongoClient.connect(url, function (err: any, db: any) {
                if (err) {
                    db.close();
                    reject(err);
                }
                let query = {
                    'documento': dni.substring(0, 1) !== '0' ? dni : dni.substring(1, 9),
                    'sexo': (sexo === 'F') ? 'femenino' : 'masculino'
                }

                db.collection(coleccion).findOne(query, async function (err, pac) {
                    // console.log("Procesando: ", pac)
                    if (err) {
                        console.log('err: ', err);
                        reject(err);
                    }
                    if (pac && pac.documento && !pac.cuil) {
                        pac['cuil'] = cuil;
                        let op = new PacienteMpi();
                        await op.cuilificaPaciente(pac, configPrivate.secret.token);
                    }
                    db.close();
                    resolve(true);
                });
            })
        })
    }
}

// Exporta todos los pacientes de mongo a un archivo .txt para enviar a sips.
function exportPacientes() {
    MongoClient.connect(url, function (err: any, dbMongo: any) {
        if (err) {
            console.log('Error conectando a mongoClient', err);
            dbMongo.close();
        }
        dbMongo.collection(coleccion).find({}).toArray(function (err, docs) {
            console.log("Found the following records: ", docs.length);
            let writer = fs.createWriteStream('exportPatient.txt', {
                flags: 'a' // 'a' means appending (old data will be preserved)
            })
            docs.forEach(element => {
                let sexo = (element.sexo == 'femenino') ? 'F' : 'M';
                // Formateamos nombre de acuerdo a especificaciones
                let longNombre = element.apellido.length + element.nombre.length;
                let nombreCompleto = element.apellido + ' ' + element.nombre;
                for (let i = longNombre + 1; i < 40; i++) {
                    nombreCompleto = nombreCompleto + ' ';
                }
                if (longNombre > 39) {
                    nombreCompleto = nombreCompleto.substring(0, 40);
                }
                let doc = element.documento;
                // formateamos la fecha "aaammdd"
                let mes = (((element.fechaNacimiento.getMonth() + 1).toString()).length === 1) ? ('0' + (element.fechaNacimiento.getMonth() + 1).toString()) : (element.fechaNacimiento.getMonth() + 1).toString();
                let dia = ((element.fechaNacimiento.getDate().toString()).length === 1) ? ('0' + (element.fechaNacimiento.getDate().toString())) : element.fechaNacimiento.getDate().toString();
                let fechaNac = element.fechaNacimiento.getFullYear().toString() + mes + dia;
                // formateamos DNI
                let longDocumento = element.documento.length;
                for (let i = longDocumento; i < 8; i++) {
                    doc = '0' + doc;
                }
                if (longDocumento > 8) {
                    doc = doc.substring(0, 8);
                }
                // writer.write('29' + doc + nombreCompleto + sexo + fechaNac + '                                                                                                    ');
                // writer.write('\n');
            });
            dbMongo.close();
        });
    })
}

/* Exportar pacientes a ANSES*/
/* TODO: Tarda demasiado, probar de hacer un SP en SQL Server*/
async function exportarPacientesAnses() {
    const query_limit = 1000000;

    var connection = {
        user: configPrivate.authSql.user,
        password: configPrivate.authSql.password,
        server: configPrivate.serverSql.server,
        database: configPrivate.serverSql.database,
        requestTimeout: 1900000,
        stream: true
    };

    let pool = await new sql.ConnectionPool(connection).connect();



    MongoClient.connect(url, async function (err: any, dbMongo: any) {
        if (err) {
            console.log('Error conectando a mongoClient', err);
            dbMongo.close();
        }
        console.log("Exportando a ANSES...")
        let cursor = dbMongo.collection('sipsCuilificado').aggregate([
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
        let i = 1000;
        let total = 0;

        let menores = 0;
        let cantPrestaciones = 0;

        let listaPacienteAnses: any = [];

        await cursorArray.then(async pacientesCuil => {
            console.log("Paccc: ", pacientesCuil.length)

            while (x < pacientesCuil.length) {

                let arrayCuil = pacientesCuil.slice(x, x + i);

                let prestaciones: any = await getNomivacExcel(arrayCuil, pool);
                prestaciones = prestaciones.recordset;

                cantPrestaciones = cantPrestaciones + prestaciones.length;
                // console.log("Capoooooo: ", prestaciones);
                // break;
                for (let q = 0; q < prestaciones.length; q++) {
                    let edad = await getEdadPaciente(pacientesCuil[q].fechaNacimiento);                    

                    if (edad < 18) {
                        menores++;
                        let pacienteAnses: any = {};
                        pacienteAnses['cuil'] = pacientesCuil[q].cuil;
                        pacienteAnses['cuie'] = prestaciones[q].Cuie;
                        pacienteAnses['establecimiento'] = prestaciones[q].Efector;
                        pacienteAnses['fechaControl'] = prestaciones[q].Fecha;
                        pacienteAnses['discapacitado'] = '  ';
                        pacienteAnses['esquema'] = 'EN';
                        pacienteAnses['codigoEstablecimiento'] = (prestaciones[q].CodigoEstablecimiento) ? prestaciones[q].CodigoEstablecimiento : ''; //(vacunas) ? vacunas[0].CodEstablecimiento : '';
                        pacienteAnses['Establecimiento'] = (prestaciones[q].Establecimiento) ? prestaciones[q].Establecimiento : ' ';// (vacunas) ? vacunas[0].NombreEstablecimiento : '';
                        pacienteAnses['fechaAplicacion'] = (prestaciones[q].fechaAplicacion) ? prestaciones[q].fechaAplicacion : '';//(vacunas) ? vacunas[0].FechaAplicacion : '';
                        pacienteAnses['dependencia'] = '        ';
                        pacienteAnses['sumar'] = prestaciones[q].sumar;

                        listaPacienteAnses.push(pacienteAnses);
                    }
                    // console.log("Lista de Pacientes: ", pacienteAnses)
                }

                // listaPacienteAnses.push(pacienteAnses);

                x = x + i;
            }

            pool.close();
            // console.log("Encontrado: ", listaPacienteAnses)
        });

        await procesarDatosAnses(listaPacienteAnses);
        console.log("Menores: ", menores);
        console.log("Cant de Prestaciones: ", cantPrestaciones);
    });
}

async function procesarDatosAnses(data) {

    let writer = fs.createWriteStream('pacientes_anses.txt', {
        flags: 'a' // 'a' means appending (old data will be preserved)
    });

    data.forEach(x => {        
        let cuil = x.cuil;
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

// async function getDatosSumar(dni, pool) {
//     return await pool.request()
//         .input('dni', sql.VarChar(50), dni)
//         .input('activo', sql.Char, 'S')
//         .input('aficlasedoc', sql.Char, 'P')
//         .query('SELECT * FROM dbo.PN_smiafiliados WHERE afidni = @dni and activo = @activo AND aficlasedoc = @aficlasedoc');
// }

// async function getPrestacion(dni, pool) {
//     return await pool.request()
//         .input('dni', sql.VarChar(50), dni)
//         .query('SELECT e.nombre as Efector, c.fecha as Fecha, p.fechaNacimiento as FechaNacimiento, e.cuie as Cuie FROM dbo.CON_ConsultaDiagnostico cd '
//             + 'INNER JOIN dbo.CON_Consulta c ON c.idConsulta = cd.idConsulta '
//             + 'INNER JOIN dbo.Sys_Efector e ON e.idEfector = c.idEfector '
//             + 'INNER JOIN dbo.Sys_Paciente p ON p.idPaciente = c.idPaciente '
//             + 'WHERE p.numeroDocumento = @dni and cd.CODCIE10 IN (9448, 9449, 9450, 9451)');
// }

// async function getNomivac(dni, pool) {
//     return await pool.request()
//         .input('dni', sql.VarChar(50), dni)
//         .query('SELECT [Código de establecimiento] as CodEstablecimiento,Establecimiento as NombreEstablecimiento, [Fecha de aplicación] as FechaAplicacion FROM dbo.NomivacExcel where [Nro# de documento] = @dni')
// }


async function getNomivacExcel(pacientesCuil, pool) {

    let sQuery = " SELECT  p.numeroDocumento, n.Establecimiento, n.[Código de establecimiento]AS CodigoEstablecimiento, n.[Fecha de aplicación] AS fechaAplicacion, p.nombre, p.apellido, e.nombre as Efector, c.fecha as Fecha, p.fechaNacimiento as FechaNacimiento, e.cuie as Cuie, "
        + " CASE WHEN a.activo = 'S' AND a.aficlasedoc = 'P' "
        + "          THEN 'SI' "
        + "       ELSE 'NO' "
        + " END AS sumar "
        + " FROM dbo.CON_ConsultaDiagnostico cd "
        + " INNER JOIN dbo.CON_Consulta c ON c.idConsulta = cd.idConsulta "
        + " INNER JOIN dbo.Sys_Efector e ON e.idEfector = c.idEfector "
        + "INNER JOIN dbo.Sys_Paciente p ON p.idPaciente = c.idPaciente  "
        + "LEFT JOIN dbo.NomivacExcel n ON n.[Nro# de documento] = p.numeroDocumento "
        + " LEFT JOIN dbo.PN_smiafiliados a ON a.afidni = CONVERT(VARCHAR(10), p.numeroDocumento) "
        + " WHERE p.numeroDocumento in (";
    for (let p = 0; p < pacientesCuil.length; p++) {
        // sQuery += "'" + pacientesCuil[p].documento + "',";
        sQuery += "'48969032',";
    }
    sQuery = sQuery.substring(0, sQuery.length - 1, );
    sQuery += ") and  cd.CODCIE10 IN (9448, 9449, 9450, 9451) ";

    // console.log("Queryyy: ", sQuery);
    return await pool.request()
        .query(sQuery);
}

// async function getPrestaciones(dni, pool) {
//     return await pool.request()
//         .input('dni', sql.VarChar(50), dni)
//         .execute('SP_Cuilificador')
// }

function getEdadPaciente(fechaNacimiento: string): number {    
    let edad = moment().diff(fechaNacimiento, 'years');
    
    return edad;
}

