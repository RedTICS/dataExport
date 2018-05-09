import * as configPrivate from './config.private';
import { resolve } from 'path';
import { PacienteMpi } from './paciente.service';
import * as pacienteSumar from './paciente-sumar.service';
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

            let opcion = [{
                name: 'pacienteMPI',
                type: 'list',
                message: 'Seleccione cuilificación con MPI o sin MPI: ',
                choices: [
                    {
                        name: 'Con MPI', value: 1
                    },
                    {
                        name: 'Sin MPI', value: 2
                    }]
            }]

            inquirer.prompt(opcion).then(answers => {
                console.log("Respuesta", answers)
                let mpi;
                if (answers.pacienteMpi === 1) {
                    mpi = true;
                } else {
                    mpi = false;
                }

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
                                    importarPacientesCuilificados(fileSelected.archivoElegido, mpi)
                                        .then(function (resultado) {
                                            return true;
                                        })
                                        .catch(function (err) {
                                            console.log('err: ', err)
                                        })
                                })
                        }
                    })
            });



        } else if (answers.cuilificar === 'exportar') {
            exportPacientes();
        } else if (answers.cuilificar === 'exportar_anses') {
            pacienteSumar.exportarPacientesAnses();
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

async function importarPacientesCuilificados(arch: any, mpi: boolean) {
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

                    if (mpi) {
                        procesarDatos(pacientesCuilificados)
                    } else {
                        guardaSipsCuilificado(pacientesCuilificados);
                    }

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
    let paciente: any;

    while (index > -1) {
        let linea = remaining.substring(0, index);
        console.log(linea);
        x++;
        console.log("Total: ", x)

        let nombreCompleto = linea.substring(10, 49);
        let dni = linea.substring(2, 10);
        let sexo = linea.substring(50, 51);
        let cuil = linea.substring(149, 160);
        let fechaNacimiento = linea.substring(51, 59);

        paciente = {
            nombreCompleto: nombreCompleto,
            documento: dni,
            sexo: sexo,
            cuil: cuil,
            fechaNacimiento: fechaNacimiento
        }

        pacCuil.push(paciente);

        remaining = remaining.substring(index + 1);
        index = remaining.indexOf('\n');
    }

    var total_entries = pacCuil.length;

    MongoClient.connect(url, function (err, db) {
        var col = db.collection(coleccion);

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
    });

    console.log("Cant Pac.: ", pacCuil.length);
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
                
                writer.write('29' + doc + nombreCompleto + sexo + fechaNac + '                                                                                                    ');
                writer.write('\n');
            });
            dbMongo.close();
        });
    })
}

