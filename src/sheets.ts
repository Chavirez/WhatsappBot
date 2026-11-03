import { JWT } from 'google-auth-library'
import { GoogleSpreadsheet } from 'google-spreadsheet'
import credentials from '../google-credentials.json'

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID ?? '18k9ZtFQoc96tAP9L1atZD8EFhoCkN0_0-Rf7_S2hwd0'

const serviceAccountAuth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

export const appendLeadToSheet = async (data: Record<string, any>) => {
    try {
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth)
        await doc.loadInfo()

        // Obtains the first sheet/tab
        const sheet = doc.sheetsByIndex[0]

        // Appends a new row matching your column headers
        await sheet.addRow({
            Fecha: new Date().toLocaleString('es-MX', { timeZone: 'America/Hermosillo' }),
            Telefono: data.phone ?? '',
            NombreYEdad: data.nameAndAge ?? '',
            Trabajo: data.occupation ?? '',
            IngresoMensual: data.monthlyIncome ?? '',
            TiempoTrabajo: data.employmentDuration ?? '',
            CompruebaIngresos: data.canVerifyIncome ?? '',
            Colonia: data.neighborhood ?? '',
            Vivienda: data.housing ?? '',
            NegocioPropio: data.hasBusiness ?? '',
        })
    } catch (error) {
        console.error('Error al guardar en Google Sheets:', error)
    }
}