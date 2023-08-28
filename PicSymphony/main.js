//import packages
const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');//for media uploads
const fs = require('fs');
const setUploadLocation = 'newSrc/uploads';//set the desired file location, this should already be set by default but you can change the path
let makeImgUnique = 0;//will generate a unique value for the images to avoid name conflicts

//for the above what I can try is something with filesystem from node

//aka fs link here https://nodejs.org/api/fs.html#file-system 
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, setUploadLocation));
    },
    filename: (req, file, cb)=> {
        fs.stat(path.join(__dirname, `/newSrc/uploads/${file.originalname}`), (err, stats) => {//check to see if file already exists
            if(stats){// if the file already exists in uploads
                cb(null,  `(${makeImgUnique++})${file.originalname}`);//save the name as file.originalname
                //post increment is necessary due to the asynchronous nature of the functions
                //since updating the files in the path and storing information in the DB via the socket
                //are happening simultaneously pre-increment would cause the socket to register n - 1
                //for any makeImgUnique value where it is greater than 0
                //if you would like to do  
            }
            else{//if it doesn't
                cb(null, file.originalname);//save the name as (1)file.originalname this would be for 
            }
        });
    }
});
//
//mongodb uri to access DB and collection  to use:
const dbToAccess = 'canvas';
const uri = `mongodb://localhost:27017/${dbToAccess}`;
const collection = 'elemlocs';//mongoose queries by the plural of this so the data is actually in elemLOcs
//

const http = require('http').Server(app);// bind app with http request 
const io = require('socket.io')(http);//attatch http server to the socket.io
const upload = multer({storage: storage}); //upload middleware

//specify port and host
const port = process.env.PORT || 3000;
const host = '127.0.0.1';
const schema = mongoose.Schema;


//setting up the schema for our DB
const images = new schema({
    _id: mongoose.Types.ObjectId,
    img: String,
    x: String,
    y: String,
    height: String,
    width: String
})
//the schema will establish how the document will be in
//for the schema we want to be able to save 
//now we set up our model...
const imageCollect = mongoose.model(collection, images)// params passed are the collection name and the newly created schema name

//connect our datatbase
mongoose.connect(uri).then(() => console.log(`connection to ${dbToAccess} database successful`)).catch(() => {console.log(`could not connect to ${dbToAccess} database`)});;//establishing the connection uses buffering so the schema/model are created even if we didn't connect to DB
//delay for 5 seconds
async function getPositions(){
    const got = await imageCollect.find({});//find all items stored in the DB
    return got;
}
let storeData;
getPositions().then(initFetch => storeData = initFetch).catch((err) => {console.error(err)})

//serve static content
app.use(express.static(path.join(__dirname, 'newSrc')));//we need so statically serve our images
//will return an array of the documents from the db
//JSON.stringify() the fetched data to ouput the log to the console on the client side
//create a new connection

app.get('/', (req, res, next) =>{//setting our route and serving the page
    res.sendFile(path.join(__dirname, '/newSrc/client/index.html'));
});

app.post('/', upload.single('img-uploaded'), (req, res, next) =>{//handles form submission specifically for allocating user upload of the image
    res.redirect('/');//redirect to the same page which will simultaneously load all of the newly generated content
});



//handling the socket events...
io.on('connection', (socket) =>{//instantiate and establish the socket so that we can connect to the client
    console.log(`user connected with session id: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`user ${socket.id} disconnected\n`);
        //this case happens when the user will reload or closes the tab
        //in this case we need to fetch the latest data from the DB
        getPositions().then(reFetch => storeData = reFetch).catch((err) => {console.error(err)})//refetch to serve newest addition
    });
    
    socket.emit("canvasLocs", storeData);//serve when client connects and reconnect
    
    socket.on('coord', (userAdding) => {//user is adding an image
        //the call will return {x:..., y:..., height:..., width:...}
        fs.stat(path.join(__dirname, `/newSrc/uploads/${path.basename(userAdding.img)}`), (err, stats) => {
            if(stats){//case where there IS an image with the same name
                const newImage = new imageCollect({//instantiate the model
                    _id: new mongoose.Types.ObjectId,
                    img: `(${makeImgUnique})${path.basename(userAdding.img)}`,//store filename with unique number
                    x: userAdding.x,
                    y: userAdding.y,
                    height: userAdding.height,
                    width: userAdding.width
                });
                newImage.save().then((doc) => (console.log(`\nDatabase updated! ID: ${doc._id.toString()}\n`))).catch(()=> console.log('\nCould not update the database!\n'));
                io.emit('update', userAdding.x, userAdding.y, `(${makeImgUnique})${path.basename(userAdding.img)}`);//can update live all I am doing is simply sending an image
                //notify all clients
                //with the current implementation on the front end the struggle is mostly found in the fact that 
            }
            else{//case where there isn't an image with the same name
                const newImage = new imageCollect({//instantiate the model
                    _id: new mongoose.Types.ObjectId,
                    img: path.basename(userAdding.img),//get the filename with the cached 
                    x: userAdding.x,
                    y: userAdding.y,
                    height: userAdding.height,
                    width: userAdding.width
                });
                newImage.save().then((doc) => (console.log(`\nDatabase updated! ID: ${doc._id.toString()}\n`))).catch(()=> console.log('\nCould not update the database!\n'));
                io.emit('update', userAdding.x, userAdding.y, path.basename(userAdding.img));//can update live all I am doing is simply sending an image
                //notify all clients
                //with the current implementation on the front end the struggle is mostly found in the fact that 
            }
        });
    });
})

http.listen(port, () => {
    console.log(`Server is live at http://${host}:${port}/...\n`);
})