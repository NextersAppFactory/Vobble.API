'use strict';

var crypto = require('crypto')
  , sequelize
  , User
  , Vobble;

var voidHandler = function(req, res) {
  res.send(404);
};

exports.init = function(app) {
  sequelize = app.get('sequelize');
  User = app.get('db').User;
  Vobble = app.get('db').Vobble;

  app.post('/users', handlers.createUsers);
  app.post('/tokens', handlers.createTokens);
  app.post('/users/:userId/vobbles', handlers.createVobbles);
  app.get('/vobbles', handlers.getVobbles);
};

var handlers = exports.handlers = {
  createUsers: function(req, res) {
    var email = req.body.email
      , username = req.body.username
      , password = req.body.password;

    User.find({ where: { email: email } }).success(function(user) {
      if (user) {
        // TODO: 상태 코드 맞는지 확인
        res.send(400, {
          result: 0,
          msg: '이미 가입된 회원'
        });
      } else {
        var token = crypto
                      .createHash('md5')
                      .update(email + (new Date()).getTime() + 'vobble')
                      .digest('hex');

        var user = {
          email: email,
          username: username,
          password: password,
          token: token
        };

        User.create(user).success(function() {
          res.send(200, {
            result: 1,
            msg: '회원 가입 성공'
          });
        }).error(function(err) {
          res.send(500, {
            result: 0,
            msg: '서버 오류'
          });
        });
      }
    }).error(function(err) {
      res.send(500, {
        result: 0,
        msg: '서버 오류'
      });
    });
  },

  createTokens: function(req, res) {
    var email = req.body.email
      , password = req.body.password;

    User.find({ where: { email: email, password: password } }).success(function(user) {
      if (user) {
        res.send(200, {
          result: 1,
          msg: '로그인 성공',
          user_id: user.user_id,
          token: user.token
        });
      } else {
        res.send(400, {
          result: 0,
          msg: '회원 정보 없음'
        });
      }
    }).error(function(err) {
      res.send(500, {
        result: 0,
        msg: '서버 오류'
      });
    });
  },

  createVobbles: function(req, res) {
    var userId = req.params.userId
      , token = req.body.token
      , latitude = req.body.latitude
      , longitude = req.body.longitude
      , voicePath = req.files.voice.path
      , voiceName = voicePath.substring(voicePath.lastIndexOf('/') + 1)
      , imagePath = req.files.image ? req.files.image.path : ''
      , imageName = imagePath ? imagePath.substring(imagePath.lastIndexOf('/') + 1) : '';

    User.find({ where: { token: token } }).success(function(user) {
      if (user) {
        if (userId !== user.user_id + '') {
          res.send(401, {
            result: 0,
            msg: '권한 없음'
          });
          return;
        }

        var data = {
          user_id: userId,
          voice_uri: voiceName,
          image_uri: imageName,
          latitude: latitude,
          longitude: longitude
        };

        Vobble.create(data).success(function(vobble) {
          res.send(200, {
            result: 1,
            msg: '보블 생성 성공',
            vobble_id: vobble.vobble_id
          });
        }).error(function(err) {
          res.send(500, {
            result: 0,
            msg: '데이터 저장 실패'
          });
        });
      } else {
        res.send(400, {
          result: 0,
          msg: '회원 정보 없음'
        });
      }
    }).error(function(err) {
      res.send(500, {
        result: 0,
        msg: '서버 오류'
      });
    });
  },

  getVobbles: function(req, res) {
    var token = req.body.token
      , pageNum = req.body.page_num
      , latitude = req.body.latitude
      , longitude = req.body.longitude;

    User.find({ where: { token: token } }).success(function(user) {
      if (user) {
        var offset = (pageNum - 1) * 6
          , limit = 6
          , distance = 3 // 단위: km
          , queryString = 'SELECT *, ( 6371 * acos( cos( radians(' + latitude + ') ) * cos( radians( latitude ) )' +
                  ' * cos( radians( longitude ) - radians(' + longitude + ') ) + sin( radians(' + latitude + ') ) * sin( radians( latitude ) ) ) )' +
                  ' AS distance FROM vobbles HAVING distance < ' + distance + ' ORDER BY distance LIMIT ' + offset + ', ' + limit;

        sequelize.query(queryString, Vobble).success(function(vobbles) {
          var vobblesValue = vobbles.map(function(vobble) {
            return vobble.values;
          });

          res.send(200, {
            result: 1,
            data: vobblesValue
          });
        }).error(function(err) {
          res.send(500, {
            result: 0,
            msg: '서버 오류'
          });
        });
      } else {
        res.send(400, {
          result: 0,
          msg: '회원 정보 없음'
        });
      }
    }).error(function(err) {
      res.send(500, {
        result: 0,
        msg: '서버 오류'
      });
    });
  }
};