const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser') 
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000

// middleware
app.use(cors())
app.use(express.json())
app.use(cookieParser())





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mf0sj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {


    const volunteersAddCollection = client.db("volunteerPortal").collection("volunteers");
    const volunteersApplicationCollection = client.db("volunteerPortal").collection("volunteers_applications");
    const userCollection = client.db("volunteerPortal").collection("user");



    app.post('/jwt', async (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' });
  res.send({ token });
})

// middlewares 
const verifyToken = (req, res, next) => {
  // console.log('inside verify token', req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  const token = req.headers.authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}


 // use verify admin after verifyToken
 const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollection.findOne(query);
  const isAdmin = user?.role === 'admin';
  if (!isAdmin) {
    return res.status(403).send({ message: 'forbidden access' });
  }
  next();
}

    app.post('/logout',async (req, res) =>{
      res.clearCookie('token', {
        httpOnly:true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict"
      })
      .send({ success: true });
    } )


     app.get("/user", verifyToken, verifyAdmin,  async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
  });

  
    app.post('/user', async (req, res) => {
  
      const users = req.body;
      const query = {email: users.email}
      const extistingUser = await userCollection.findOne(query)
      if(extistingUser){
        return res.send({message : 'user created', insertedId: null})
      }
      const result = await userCollection.insertOne(users)
      res.send(result)
    })

     app.get('/user/admin/:email', verifyToken, async (req, res) => {
    const email = req.params.email;

    if (email !== req.decoded.email) {
      return res.status(403).send({ message: 'forbidden access' })
    }
    const query = { email: email };
    const user = await userCollection.findOne(query);
    let admin = false;
    if (user) {
      admin = user?.role === 'admin';
    }
    res.send({ admin });
  })

  app.patch("/user/admin/:id",verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
          $set: { role: "admin" },
      };
  
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
  });
  


    app.get('/volunteer', async (req, res) => {
        const result = await volunteersAddCollection.find().toArray();
        res.send(result);
      })
  
      app.get('/volunteer', async (req, res) => {

        const cursor = volunteersAddCollection.find().sort((a, b) => b.rating - a.rating).limit(6)
        const result = await cursor.toArray()
        res.send(result)
  
        
      })

      app.get('/volunteer', async (req, res) => {
        const title = req.query.title ; 
        const query = { postTitle: { $regex: title, $options: 'i' } };
        const result = await volunteersAddCollection.find(query).toArray();
    
        res.send(result);
    });

      app.get('/volunteer/:id' , async(req, res) =>{

        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await volunteersAddCollection.findOne(query)
        res.send(result)
    })
      
  

   
      app.post('/volunteer', async (req, res) => {
        const job = req.body;
        console.log(job)
        const result = await volunteersAddCollection.insertOne(job)
        res.send(result)
      })


      app.put('/volunteer/:id', async (req, res) => {

        const id = req.params.id;
        const filter = { _id: new ObjectId(id) }
        const options = {upsert: true}
        const updatePost = req.body
        const review = {
          $set: {
            postTitle:updatePost.postTitle,
            category:updatePost.category,
            location: updatePost.location,
            description:updatePost.description,
            volunteersNeeded: updatePost.volunteersNeeded,
            deadline:updatePost.deadline,
            thumbnail:updatePost.thumbnail
          }
        }
  
  
        const result = await volunteersAddCollection.updateOne(filter, review, options)
        res.send(result)
  
      })


      app.delete('/volunteer/:id', async (req, res) => {

        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await volunteersAddCollection.deleteOne(query)
        res.send(result)
      })


      // be volunteer api

      app.get('/volunteer-application', async (req, res) => {
        const result = await volunteersApplicationCollection.find().toArray();
        res.send(result);
      })

      app.post('/volunteer-application', async (req, res) => {
        const job = req.body;
        const postId = new ObjectId(job.postId);
        console.log(job)
        const result = await volunteersApplicationCollection.insertOne(job)
        const incrementResult = await volunteersAddCollection.updateOne(
          { _id: postId}, 
          { $inc: { volunteersNeeded: -1 } } 
      );
        res.send({result, incrementResult})
      })

      app.delete('/volunteer-application/:id', async (req, res) => {

        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await volunteersApplicationCollection.deleteOne(query)
        res.send(result)
      })


    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Volunteer page is available')
  })
  
  app.listen(port, () => {
    console.log(`Volunteer page is running on port ${port}`)
  })