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
            figlet.textSync('Cuilificador', {
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
                    procesarDatos(pacientesCuilificados)
                    resolve(true);
                })
            }
        });
    })
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
                    console.log("Procesando: ", pac)
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

        let writer = fs.createWriteStream('pacientes_anses.txt', {
            flags: 'a' // 'a' means appending (old data will be preserved)
        })

        let cursor = dbMongo.collection(coleccion).aggregate([
            {
                $match: { cuil: { $ne: '', $exists: true } }
            },
            { $project: { cuil: 1, documento: 1, fechaNacimiento: 1, nombre: 1, apellido: 1 } },
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
        let total = 0;

        let listaPacienteAnses: any = [];

        await cursorArray.then(async pacientesCuil => {


            for (let i = 0; i < pacientesCuil.length; i++) {
                let pacienteAnses: any = {};

                let edad = await getEdadPaciente(pacientesCuil[i].fechaNacimiento);

                if (edad > 0) {
                    let vacunas: any = await getNomivac(pacientesCuil[i].documento, pool);
                    vacunas = vacunas.recordset;

                    let prestacion: any = await getPrestacion(pacientesCuil[i].documento, pool);
                    prestacion = prestacion.recordset;
console.log("Prestaciónnn: ", prestacion[1])
console.log("********************************")
                    if (prestacion.length > 0) {
                        pacienteAnses['cuil'] = pacientesCuil[i].cuil;
                        pacienteAnses['cuie'] = prestacion[0].Cuie;
                        pacienteAnses['establecimiento'] = prestacion[0].Efector;
                        pacienteAnses['fechaControl'] = prestacion[0].Fecha;
                        pacienteAnses['discapacitado'] = '';
                        pacienteAnses['esquema'] = 'EN';
                        pacienteAnses['codigoEstablecimiento'] = vacunas[0].CodEstablecimiento;
                        pacienteAnses['nombreEstablecimiento'] = vacunas[0].NombreEstablecimiento;
                        pacienteAnses['fechaAplicacion'] = vacunas[0].FechaAplicacion;
                        pacienteAnses['dependencia'] = '';

                        let pacienteSumar: any = await getDatosSumar(pacientesCuil[i].documento, pool);
                        pacienteSumar = pacienteSumar.recordset;

                        total++;

                        if (pacienteSumar.length > 0) {
                            pacienteAnses['sumar'] = 'SI';

                            x++;
                        } else {
                            pacienteAnses['sumar'] = 'NO';
                            x++;
                        }
                        
                        listaPacienteAnses.push(pacienteAnses);                        
                    } else {

                    }
                    //console.log("------------------");
                    //  console.log("Datos del Menor: ", pacienteAnses)
                }
            }
            pool.close();
            console.log("Encontrado: ", listaPacienteAnses)
            //console.log("Total: ", total)
        });
    });
}

async function getDatosSumar(dni, pool) {
    return await pool.request()
        .input('dni', sql.VarChar(50), dni)
        .input('activo', sql.Char, 'S')
        .input('aficlasedoc', sql.Char, 'P')
        .query('SELECT * FROM dbo.PN_smiafiliados WHERE afidni = @dni and activo = @activo AND aficlasedoc = @aficlasedoc');
}

async function getPrestacion(dni, pool) {
    return await pool.request()
        .input('dni', sql.VarChar(50), dni)
        .query('SELECT e.nombre as Efector, c.fecha as Fecha, p.fechaNacimiento as FechaNacimiento, e.cuie as Cuie FROM dbo.CON_ConsultaDiagnostico cd '
            + 'INNER JOIN dbo.CON_Consulta c ON c.idConsulta = cd.idConsulta '
            + 'INNER JOIN dbo.Sys_Efector e ON e.idEfector = c.idEfector '
            + 'INNER JOIN dbo.Sys_Paciente p ON p.idPaciente = c.idPaciente '
            + 'WHERE p.numeroDocumento = @dni and cd.CODCIE10 IN (9448, 9449, 9450, 9451)');
}

async function getNomivac(dni, pool) {
    return await pool.request()
        .input('dni', sql.VarChar(50), dni)
        .query('SELECT [Código de establecimiento] as CodEstablecimiento,Establecimiento as NombreEstablecimiento, [Fecha de aplicación] as FechaAplicacion FROM dbo.NomivacExcel where [Nro# de documento] = @dni')
}

function getEdadPaciente(fechaNacimiento: string): number {
    let edad = moment().diff(fechaNacimiento, 'years');

    return edad;
}

