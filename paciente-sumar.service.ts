import * as http from 'http';
import * as sql from 'mssql';
import * as configPrivate from './config.private';

export class PacienteSumar {

    async  isPacienteSumar(dni: any, pool) {
        console.log("Dni Paciente Sumar: ", dni)       

        var listaRegistros: any[] = [];

        // return new Promise(async (resolve: any, reject: any) => {
    
        let query = "SELECT * FROM dbo.PN_smiafiliados WHERE afidni = '" + dni + "'";
        console.log("Entra a promise; ", query)
        // let capo = await executeQuery(query, pool);
        
        // (async function () {
        
        // try {
        //     // let pool = await sql.connect(connection)
        //     console.log("Entra aal Pooll: ")
        //     let result1 =await new sql.Request(pool)
        //         .input('input_parameter', sql.VarChar(50), dni)
        //         .query('SELECT * FROM dbo.PN_smiafiliados WHERE afidni = @input_parameter')

        //     console.log("Eneuntra paciente: ", result1)
        //     pepe = result1;

        //     // resolve(pepe)
        // } catch (err) {
        //     console.log("Catchhhhhh: ", err)
        //     // reject(err)

        //     // ... error checks
        // }
        // });
        // resolve(pepe)
        // });

    }
}

