const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const feedRoutes = require('./routes/feed');
const sequelize = require('./utils/database');
const Post = require('./models/post');
const User = require('./models/user');

const app = express();

app.use(bodyParser.json());
app.use((req, res, next) => {
    // set all domains that could do request to server. * every domain
    res.setHeader('Access-Control-Allow-Origin', '*');

    // methods that client can request
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');

    // headers that client can add to the request (there are default headers that are always allowed)
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    next();
})
app.use((req, res, next) => {
    User.findByPk(1)
        .then(user => {
            req.user = user;
            next();
        })
        .catch(err => {
            next();
        });
})

app.use('/images', express.static(path.join(__dirname, 'images')));


app.use('/feed', feedRoutes);

User.hasMany(Post, {
    foreignKey: {
        name: 'userId',
        allowNull: false
    }
});
Post.belongsTo(User, {
    as: 'creator',
    constraints: true,
    onDelete: 'CASCADE',
    foreignKey: {
        name: 'userId',
        allowNull: false
    }
});


sequelize
    .sync({force: true})
    .then(result => {
        console.log(result);
        return User.findByPk(1);
    })
    .then(user => {
        if (user) {
            return Promise.resolve(user);
        } else {
            return User.create({
                name: 'Marcelo Cardozo',
            })
        }
    })
    .then(user => {
        return user.getPosts()
            .then(posts => {
                console.log(posts);
                if (posts.length === 0) {
                    return user.createPost({
                        title: 'Prueba',
                        content: 'Content prueba',
                        imageUrl: '/images/2020-08-07_20-23.png'
                    });
                } else {
                    return Promise.resolve(posts[0]);
                }
            })
    })
    .then(post => {
        app.listen(8080);
    })
    .catch(err => {
        console.log(err);
    });

