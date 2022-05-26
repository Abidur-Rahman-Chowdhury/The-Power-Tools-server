const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const req = require('express/lib/request');

const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// middleware

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('The power tools server is running');
});

const tokenVerify = (req, res, next) => {
  const headerInfo = req.headers.authorization;

  if (!headerInfo) {
    return res.status(401).send({ message: 'Unauthorized Access' });
  }
  const token = headerInfo.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden Access' });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qlsma.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
async function run() {
  try {
    await client.connect();
    const userCollection = client.db('the_power_tools').collection('users');
    const profileCollection = client
      .db('the_power_tools')
      .collection('profile');
    const toolsCollection = client.db('the_power_tools').collection('tools');
    const reviewCollection = client.db('the_power_tools').collection('reviews');
    const orderCollection = client.db('the_power_tools').collection('orders');
    console.log('Connected to MongoDB');

    //    verify admin
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === 'admin') {
        next();
      } else {
        res.status(403).send({ message: 'forbidden' });
      }
    };
    //   payment api
    app.post('/create-payment-intents', tokenVerify, async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']

      });
      res.send({clientSecret: paymentIntent.client_secret})
    })
    
    // booking payment
    app.patch('/payment/:id', tokenVerify, async(req, res) =>{
      const id = req.params.id;
      
      const payment = req.body;
      const filter = {_id: ObjectId(id)};
      const updatedDoc = {
        $set: {
          status: true,
          transactionId: payment.transactionId
        }
      }

      
      const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
      res.send(updatedOrder);
    })
    // get orders by id
    app.get('/order/:id', tokenVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await orderCollection.findOne(query);
      res.send(result)
    })

    // cancel order by id

    app.delete('/cancel/:id', tokenVerify, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const result = await orderCollection.deleteOne(filter);
      res.send(result);
    })

    //  get tools 
    app.get('/tools/:id', tokenVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await toolsCollection.findOne(query);
      res.send(result)
    })
    // post to order collection
    app.post('/orders', tokenVerify, async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });
    // put to tools
    app.put('/update/tools/:id', tokenVerify, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const newAvailable = req.body;
      const options = { upsert: true };
      const updateDoc = {
        $set: { available: newAvailable.newAvailable },
      };
      const result = await toolsCollection.updateOne(
        filter,
        updateDoc,
        options
      );

      res.send(result);
    });
    //   get all orders 
    app.get('/orders/:email', tokenVerify, async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await orderCollection.find(query).toArray();
      res.send(result)
    })

    //check user Admin or not
    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin });
    });
    //  get all user
    app.get('/user', tokenVerify, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    // delete user
    app.delete('/user/:id', tokenVerify, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await userCollection.deleteOne(filter);
      res.send(result);
    });
    // make admin
    app.put(
      '/user/admin/:email',
      tokenVerify,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const filter = { email: email };
        const updateDoc = {
          $set: { role: 'admin' },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

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
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '1d' }
      );
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
      const result = await profileCollection.updateOne(
        filter,
        updateDoc,
        options
      );

      res.send(result);
    });

    // get profile data
    app.get('/getProfile/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await profileCollection.findOne(query);
      res.send(result);
    });

    // get tools
    app.get('/tools', async (req, res) => {
      const query = {};
      const result = await toolsCollection.find(query).toArray();
      res.send(result);
    });
    // post tools
    app.post('/tools', tokenVerify, verifyAdmin, async (req, res) => {
      const tools = req.body;
      const result = await toolsCollection.insertOne(tools);
      res.send(result);
    });
    // get tools by id

    app.get('/tools/:id', tokenVerify, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await toolsCollection.findOne(filter);

      res.send(result);
    });
    // delete tools by id
    app.delete('/tools/:id', tokenVerify, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await toolsCollection.deleteOne(filter);

      res.send(result);
    });
    // add review to server

    app.post('/reviews', tokenVerify, async (req, res) => {
      const reviews = req.body;
      const result = await reviewCollection.insertOne(reviews);
      res.send(result);
    });
    // get reviews
    app.get('/reviews', async (req, res) => {
      const query = {};
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });
  } finally {
  }
}

run().catch(console.error);

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
