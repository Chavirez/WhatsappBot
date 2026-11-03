import { createBot, createProvider, createFlow, addKeyword, utils } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'

const PORT = process.env.PORT ?? 3008

const loanOffer = [
    '*PRÉSTAMOS RÁPIDOS Y SENCILLOS*',
    'SIN DEJAR EMPEÑO FÍSICO',
    '',
    'Plazos de pago flexibles:',
    '✔️ 10 semanas',
    '✔️ 5 quincenas',
    '',
    'Una vez liquidado, puede volver a solicitar otro préstamo o, a partir del 6.º pago, puede renovar.',
    '',
    'SI PIDES | PAGAS A LA SEMANA',
    '$2,000 → $350',
    '$3,000 → $450',
    '$4,000 → $600',
    '$5,000 → $750',
    '',
    'Por favor, elija una de las siguientes opciones:',
    '1) QUIERO MÁS INFORMACIÓN',
    '2) ME INTERESA',
].join('\n')

const faqFlow = addKeyword<Provider, Database>(utils.setEvent('LOAN_FAQ'))
    .addAnswer(
        [
            '*PREGUNTAS FRECUENTES:*',
            '',
            '• *Requisitos:* INE y comprobante de domicilio a su nombre (predial o agua).',
            '• *Tiempo de proceso:* máximo 2 horas. Recibe su dinero el mismo día.',
            '• *¿Cómo se realiza?* Todo el trámite es por WhatsApp. No necesita acudir a ningún lugar. Entrega a domicilio en efectivo.',
            '• *¿Revisan Buró de Crédito?* No. Solo se solicita informar si cuenta con deudas pendientes.',
            '',
            '1) ME INTERESA',
            '2) NO ME INTERESA',
        ].join('\n'),
        { capture: true },
        async (ctx, { gotoFlow, fallBack }) => {
            const answer = ctx.body.trim().toLocaleLowerCase()
            if (answer === '1' || answer.includes('me interesa')) return gotoFlow(questionnaireFlow)
            if (answer === '2' || answer.includes('no me interesa')) return gotoFlow(goodbyeFlow)
            return fallBack('Por favor, conteste con *1) ME INTERESA* o *2) NO ME INTERESA*.')
        }
    )

const goodbyeFlow = addKeyword<Provider, Database>(utils.setEvent('LOAN_GOODBYE')).addAnswer(
    [
        'Muchas gracias por su interés.',
        '',
        'Si tiene alguna duda adicional en la que podamos ayudarle, no dude en contactarnos al siguiente número: 644 230 8715.',
        '',
        '¡Que tenga un buen día!',
    ].join('\n')
)

const questionnaireFlow = addKeyword<Provider, Database>(utils.setEvent('LOAN_QUESTIONNAIRE'))
    .addAnswer('Muy bien, por favor conteste las siguientes preguntas para continuar:\n\n* Nombre y edad:', { capture: true }, async (ctx, { state }) => {
        await state.update({ nameAndAge: ctx.body })
    })
    .addAnswer('* ¿En qué trabaja?', { capture: true }, async (ctx, { state }) => {
        await state.update({ occupation: ctx.body })
    })
    .addAnswer('* ¿Cuál es su ingreso mensual?', { capture: true }, async (ctx, { state }) => {
        await state.update({ monthlyIncome: ctx.body })
    })
    .addAnswer('* ¿Cuánto tiempo lleva en su trabajo?', { capture: true }, async (ctx, { state }) => {
        await state.update({ employmentDuration: ctx.body })
    })
    .addAnswer('* ¿Puede comprobar ingresos?', { capture: true }, async (ctx, { state }) => {
        await state.update({ canVerifyIncome: ctx.body })
    })
    .addAnswer('* ¿En qué colonia vive?', { capture: true }, async (ctx, { state }) => {
        await state.update({ neighborhood: ctx.body })
    })
    .addAnswer('* ¿Su casa es propia, rentada o prestada?', { capture: true }, async (ctx, { state }) => {
        await state.update({ housing: ctx.body })
    })
    .addAnswer('* ¿Tiene negocio propio?', { capture: true }, async (ctx, { state }) => {
        await state.update({ hasBusiness: ctx.body })
    })
    .addAnswer('Gracias por compartir su información. Revisaremos sus datos y nos pondremos en contacto con usted.', { delay: 500 })

const welcomeFlow = addKeyword<Provider, Database>([
    'hi',
    'hello',
    'hola',
    'prestamo',
    'préstamo',
    utils.setEvent('LOAN_START'),
    utils.setEvent('LOAN_REMINDER'),
])
    .addAnswer(loanOffer, { capture: true }, async (ctx, { gotoFlow, fallBack }) => {
        const answer = ctx.body.trim().toLocaleLowerCase()
        if (answer === '1' || answer.includes('más información') || answer.includes('mas informacion')) {
            return gotoFlow(faqFlow)
        }
        if (answer === '2' || answer.includes('me interesa')) return gotoFlow(questionnaireFlow)
        return fallBack('Por favor, conteste con *1) QUIERO MÁS INFORMACIÓN* o *2) ME INTERESA*.')
    })

const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, faqFlow, goodbyeFlow, questionnaireFlow])
    
    // If you experience ERRO AUTH issues, check the latest WhatsApp version at:
    // https://wppconnect.io/whatsapp-versions/
    // Example: version "2.3000.1035824857-alpha" -> [2, 3000, 1035824857]
    const adapterProvider = createProvider(Provider, 
		{ version: [2, 3000, 1035824857] } 
	)
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/loan/reminder',
        handleCtx(async (bot, req, res) => {
            const { number } = req.body
            await bot.dispatch('LOAN_REMINDER', { from: number })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    adapterProvider.server.get(
        '/v1/blacklist/list',
        handleCtx(async (bot, req, res) => {
            const blacklist = bot.blacklist.getList()
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', blacklist }))
        })
    )

    httpServer(+PORT)
}

main()
