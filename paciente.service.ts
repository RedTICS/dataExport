import * as http from 'http';
import * as configPrivate from './config.private';

export class PacienteMpi {

    cuilificaPaciente(patient: any, token: any) {
        return new Promise((resolve: any, reject: any) => {
            let id = patient._id;
            // delete paciente._id; //Borro el id para que no se duplique
            let options = {
                host: configPrivate.network.host,
                port: configPrivate.network.port,
                path: configPrivate.URL.base + '/' + id,
                method: 'PATCH',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json',
                }
            };
            let req = http.request(options, function (res) {
                res.on('data', function (result) {
                    // console.log('paciente actualizado: ', patient.apellido, patient.nombre, patient.documento);
console.log("Pepepe: ", req)
                    resolve(result);
                });
            });
            req.on('error', function (e) {
                console.log('Problemas API en update : ' + e.message + ' ----- ', e);
                reject(e.message);
            });
            /*write data to request body*/

            req.write(JSON.stringify({ op: 'updateCuil', cuil: patient.cuil }));
            req.end();
        });

    };
}
