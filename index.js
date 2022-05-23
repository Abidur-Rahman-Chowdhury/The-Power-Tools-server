const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();	
// middleware

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => { 

    res.send('The power tools server is running');
});

const tokenVerify = (req, res, next) => {
    const headerInfo = req.headers.authorization;
    
    if (!headerInfo) {
        return res.status(401).send({message: 'Unauthorized Access'})
    }
    const token = headerInfo.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
          return  res.status(403).send({message: 'Forbidden Access'})
        }
        req.decoded = decoded;
        next();
    })
   
    
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qlsma.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() { 

    try {
        await client.connect();
        const userCollection = client.db('the_power_tools').collection('users');
        console.log('Connected to MongoDB');	
        
       
        // create user and secure API with jwt
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
              $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
            res.send({ result, token });
          });
        
    }
    finally {

    }
}

run().catch(console.error);

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});