const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require("multer");
const {v4: uuidv4} = require('uuid');
const {graphqlHTTP} = require('express-graphql');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middlewares/auth');
const sequelize = require('./utils/database');
const Post = require('./models/post');
const User = require('./models/user');

const app = express();

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const err = null;
        const folder = './images';
        cb(err, folder);
    },
    filename: (req, file, cb) => {
        const err = null;
        cb(err, uuidv4());
    },
});

const fileFilter = (req, file, cb) => {
    // only accept png, jpg and jpeg files
    if (
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg'
    ) {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

app.use(compression());
app.use(helmet());

// create a write stream (in append mode)
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
// setup the logger
app.use(morgan('combined', { stream: accessLogStream }))


app.use(bodyParser.json());
app.use(
    multer({
        storage: fileStorage,
        fileFilter: fileFilter,
    }).single('image')
);
app.use((req, res, next) => {
    // set all domains that could do request to server. * every domain
    res.setHeader('Access-Control-Allow-Origin', '*');

    // methods that client can request
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

    // headers that client can add to the request (there are default headers that are always allowed)
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS')
        return res.sendStatus(200);

    next();
})

app.use(auth);

app.use('/images', express.static(path.join(__dirname, 'images')));

app.put('/image', (req, res, next) => {
    if(!req.isAuth){
        const err = new Error('Not authenticated');
        err.code = 401;
        throw err;
    }

    const file = req.file;
    if (!file) {
        return res.status(200).json({
            message: 'No image found',
        })
    }

    if(req.body.oldPath){
        removeFile(req.body.oldPath);
    }

    return res.status(201).json({
        imageUrl: file.path,
        message: 'File stored',
    })
})


app.use('/graphql', graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    formatError(err) {
        // error thrown was not explicitly written by the developer
        if (!err.originalError) {
            return err;
        }

        const data = err.originalError.data;
        const message = err.message || 'An error ocurred';
        const code = err.originalError.code || 500;

        return {data, message, code}
    }
}))

app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;

    return res.status(statusCode).json({
        message: err.message,
        data: err.data,
    })
})

User.hasMany(Post, {
    foreignKey: {
        name: 'creatorId',
        allowNull: false
    }
});
Post.belongsTo(User, {
    as: 'creator',
    constraints: true,
    onDelete: 'CASCADE',
    foreignKey: {
        name: 'creatorId',
        allowNull: false
    }
});


sequelize
    .sync({force: true})
    .then(result => {
        app.listen(process.env.PORT);
    })
    .catch(err => {
        console.log(err);
    });

