var functions = require('firebase-functions')
var express = require('express')
var setlistsRouter = express.Router()
var request = require('request')
var transliteration = require('transliteration')
var tr = transliteration.transliterate

var config = functions.config()
var baseUrl = config.setlistfm.base_endpoint_url
var xApiKey = config.setlistfm.x_api_key

setlistsRouter.get('/setlistsByCity', (req, res) => {
  var search = req.query.search

  var authOptions = {
    url: baseUrl + ('?cityName=' + tr(search)),
    headers: {
      accept: 'application/json',
      'x-api-key': xApiKey
    }
  }

  function callback(error, response, body) {
    if (!error && response.statusCode === 200) {
      res.send(JSON.parse(body))
    } else if (response.statusCode === 404) {
      res.send('Not found!')
    }
  }

  request.get(authOptions, callback)
})

setlistsRouter.get('/setlists', (req, res) => {
  var search = JSON.parse(req.query.search)
  var page = JSON.parse(req.query.page)
  var authOptions = {
    url:
      baseUrl +
      ('?artistName=' + tr(search.artist)) +
      ('&tourName=' + tr(search.tour)) +
      ('&cityName=' + tr(search.city)) +
      ('&venueName=' + tr(search.country)) +
      ('&p=' + page),
    headers: {
      accept: 'application/json',
      'x-api-key': xApiKey
    }
  }

  function callback(error, response, body) {
    if (!error && response.statusCode === 200) {
      res.send(JSON.parse(body))
    } else if (response.statusCode === 404) {
      res.send('Not found!')
    }
  }

  request.get(authOptions, callback)
})

setlistsRouter.get('/setlist', (req, res) => {
  var search = JSON.parse(req.query.search)
  var authOptions = {
    url:
      baseUrl +
      ('?artistName=' + tr(search.artist)) +
      ('&venueName=' + tr(search.venue)),
    headers: {
      accept: 'application/json',
      'x-api-key': xApiKey
    }
  }

  function callback(error, response, body) {
    console.log(response.statusCode)
    if (!error && response.statusCode === 200) {
      var setlists = JSON.parse(body).setlist
      var setlist = setlists.filter(item => item.id === search.id)
      res.send(setlist)
    } else if (response.statusCode === 404) {
      res.send('Not found!')
    }
  }

  request.get(authOptions, callback)
})

module.exports = setlistsRouter
