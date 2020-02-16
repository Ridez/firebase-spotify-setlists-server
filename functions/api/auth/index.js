var functions = require('firebase-functions')
var express = require('express')
var authRouter = express.Router()
var querystring = require('querystring')
var request = require('request')
var admin = require('firebase-admin')
var serviceAccount = require('./service-account.json')

var config = functions.config()
var client_id = config.spotify.client_id // Your client id
var client_secret = config.spotify.client_secret // Your secret
var redirect_uri = config.spotify.redirect_uri // Your redirect uri

var stateKey = 'spotify_auth_state'

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
})

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  let text = ''
  var possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

authRouter.get('/login', (req, res) => {
  var state = generateRandomString(16)
  res.cookie(stateKey, state)

  // your application requests authorization
  var scope = 'user-read-private user-read-email'
  res.redirect(
    'https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state
      })
  )
})

authRouter.get('/callback', function(req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null
  var state = req.query.state || null
  var storedState = req.cookies ? req.cookies[stateKey] : null

  if (state === null || state !== storedState) {
    res.redirect(
      '/#' +
        querystring.stringify({
          error: 'state_mismatch'
        })
    )
  } else {
    res.clearCookie(stateKey)
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        Authorization:
          'Basic ' +
          new Buffer(client_id + ':' + client_secret).toString('base64')
      },
      json: true
    }

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token,
          refresh_token = body.refresh_token

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { Authorization: 'Bearer ' + access_token },
          json: true
        }

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          // The UID we'll assign to the user.
          var uid = `spotify:${body.id}`

          createFirebaseAccount(uid, body.display_name, access_token).then(
            firebaseToken => {
              res.redirect(
                // Front-end redirect uri
                config.app.redirect_front_uri +
                  '/#' +
                  querystring.stringify({
                    access_token: access_token,
                    refresh_token: refresh_token,
                    firebase_token: firebaseToken,
                    uid: uid
                  })
              )
            }
          )
        })

        // we can also pass the token to the browser to make requests from there
      } else {
        res.redirect(
          // Front-end redirect uri
          config.app.redirect_front_uri +
            '/#' +
            querystring.stringify({
              error: 'invalid_token'
            })
        )
      }
    })
  }
})

authRouter.get('/refresh_token', function(req, res) {
  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      Authorization:
        'Basic ' +
        new Buffer(client_id + ':' + client_secret).toString('base64')
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  }

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token
      res.send({
        access_token: access_token
      })
    }
  })
})

function createFirebaseAccount(uid, displayName, accessToken) {
  // Save the access token to the Firebase Realtime Database.
  var databaseTask = admin
    .database()
    .ref(`/spotifyAccessToken/${uid}`)
    .set(accessToken)

  // Create or update the user account.
  var userCreationTask = admin
    .auth()
    .updateUser(uid, {
      displayName: displayName
    })
    .catch(error => {
      // If user does not exists we create it.
      if (error.code === 'auth/user-not-found') {
        return admin.auth().createUser({
          uid: uid,
          displayName: displayName
        })
      }
      throw error
    })

  // Wait for all async task to complete then generate and return a custom auth token.
  return Promise.all([userCreationTask, databaseTask]).then(() => {
    // Create a Firebase custom auth token.
    var token = admin.auth().createCustomToken(uid)
    console.log('Created Custom token for UID "', uid, '" Token:', token)
    return token
  })
}

module.exports = authRouter
