import * as configPrivate from './config.private';
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;

const url = configPrivate.mongoDB.host;
const coleccion = configPrivate.mongoDB.collection;

inicio();

function inicio() {
    console.log("Ingrese una opción:");
    console.log("1- Importar pacientes cuilificados");
    console.log("2- Exportar pacientes cuilificados");
    console.log("3- Nada");

    process.argv.forEach((val, index) => {
        console.log(`${index}: ${val}`);
      });

    

    // let args = process.argv[2];
    // console.log("Args: ", args);
    // importarPacientesCuilificados();
    // exportPacientes();
}

function importarPacientesCuilificados() {
    let args = process.argv.slice(2);
    console.log("Entrando a pacientes cuilificados: ", args[0]);

    let archivo;

    let nombreArchivo = './pacientes_cuilificados.txt';

    fs.exists(nombreArchivo, function (exists) {
        if (exists) { // results true
            fs.readFile(nombreArchivo, { encoding: "utf8" }, function (err, data) {
                if (err) {
                    console.log(err)
                }
                let pacientesCuilificados: any[] = data;
                //procesarDatos(pacientesCuilificados);

                // console.log(data);
            })
        }
    });
}

function procesarDatos(data) {
    var remaining = '';
    let x = 1;

    remaining += data;
    let index = remaining.indexOf('\n');

    while (index > -1) {
        let linea = remaining.substring(0, index);
        remaining = remaining.substring(index + 1);
        func(linea);
        index = remaining.indexOf('\n');
    }

    function func(data) {
        let dni = data.substring(2, 10);
        let nombreCompleto = data.substring(10, 49);
        let sexo = data.substring(50, 51);
        let fechaNacimiento = data.substring(51, 59);
        let fechaFallecimiento = data.substring(59, 67);
        let cuil = data.substring(149, 160);
        console.log('Reg Nº ' + x + ' : ' + dni + ' - ' + nombreCompleto + ' - ' + sexo + ' - ' + fechaNacimiento + ' - ' + fechaFallecimiento + ' - ' + cuil);
        x++;
    }
}

function exportPacientes() {
    console.log("Entrando a la funcion");
    MongoClient.connect(url, function (err: any, dbMongo: any) {
        if (err) {
            console.log('Error conectando a mongoClient', err);
            dbMongo.close();
        }
        dbMongo.collection(coleccion).find({}).toArray(function (err, docs) {
            console.log("Found the following records: ", docs.length);
            let writer = fs.createWriteStream('export_sips.txt', {
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
