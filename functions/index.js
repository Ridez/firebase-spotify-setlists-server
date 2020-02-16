var functions = require('firebase-functions')
var express = require('express')
var cors = require('cors')
var cookieParser = require('cookie-parser')

var app = express()

app
  .use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser())

//Auth
var authRouter = require('./api/auth')
app.use(authRouter)

//Setlists
var setlistsRouter = require('./api/setlists')
app.use(setlistsRouter)

exports.api = functions.region('europe-west1').https.onRequest(app)
