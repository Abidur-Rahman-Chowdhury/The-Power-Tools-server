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
        const profileCollection = client.db('the_power_tools').collection('profile');
        const toolsCollection = client.db('the_power_tools').collection('tools');
        console.log('Connected to MongoDB');	
        
    //    verify admin
    const verifyAdmin = async (req, res, next) => {
        const requester = req.decoded.email;
        const requesterAccount = await userCollection.findOne({ email: requester });
        if (requesterAccount.role === 'admin') {
          next();
        }
        else {
          res.status(403).send({ message: 'forbidden' });
        }
      }



        //check user Admin or not
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })
        
        app.put('/user/admin/:email', tokenVerify, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
              $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
          })

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
      
      // set profile data to mongodb
      app.put('/profile/:email', async (req, res) => {
        const email = req.params.email;
        const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
              $set: user,
            };
            const result = await profileCollection.updateOne(filter, updateDoc, options);

        res.send(result);
      })

      // get profile data 
      app.get('/getProfile/:email', async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const result = await profileCollection.findOne(query);
        res.send(result);
      })

      // get tools
      app.get('/tools', async (req, res) => {
        const query = {};
        const result = await toolsCollection.find(query).toArray();
        res.send(result);
      })
      app.post('/tools', tokenVerify,verifyAdmin, async (req, res) => {
        const tools = req.body;
        const result = await toolsCollection.insertOne(tools);
        res.send(result);
      })
        
    }
    finally {

    }
}

run().catch(console.error);

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});