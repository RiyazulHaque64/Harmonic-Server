const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Configure express app
const app = express();

// cors config
const corsConfig = {
  origin: "",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
};
app.use(cors(corsConfig));
app.options("", cors(corsConfig));
app.use(cors());

// Use middleware
app.use(express.json());

// Port cofigure
const port = process.env.PORT || 5000;

// stripe
const stripe = require("stripe")(`${process.env.PAYMENT_SECRET_KEY}`);

// Main api
app.get("/", (req, res) => {
  res.send("Harmonic server is running ....");
});

// Mongodb url
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vp8crsv.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Middleware function for verify jwt token
function verifyJWT(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Harmonic db collections
    const usersCollection = client.db("harmonicDB").collection("users");
    const classesCollection = client.db("harmonicDB").collection("classes");
    const selectedCollection = client.db("harmonicDB").collection("selected");
    const enrolledClassesCollection = client
      .db("harmonicDB")
      .collection("enrolledClasses");

    // Generate JWT
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token });
    });

    // Generate client secret TODO: add jwt
    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body;
      if (price.payingAmount) {
        const amount = parseFloat(price.payingAmount) * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      }
    });

    // Users API
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // Get all users
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Get a user
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // Get all classes
    app.get("/classes", verifyJWT, async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    // Get approved classes
    app.get("/classes/approved", async (req, res) => {
      const query = { status: "approved" };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    // Get my classes
    app.get("/classes/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (!email || req.decoded.email !== email) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access" });
      }
      const query = { instructorEmail: email };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    // Get popular classes
    app.get("/popularClasses", async (req, res) => {
      const result = await classesCollection
        .find()
        .sort({ enrolledStudent: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // Get top instructor
    app.get("/topInstructor", async (req, res) => {
      const query = { role: "instructor" };
      const result = await usersCollection.find(query).limit(6).toArray();
      res.send(result);
    });

    // Get all instructor
    app.get("/instructor", async (req, res) => {
      const query = { role: "instructor" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    // Add Class
    app.post("/classes", async (req, res) => {
      const classInfo = req.body;
      const result = await classesCollection.insertOne(classInfo);
      res.send(result);
    });

    // Update Class
    app.patch("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const classInfo = req.body;
      const updateDoc = {
        $set: classInfo,
      };
      const result = await classesCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Get from selected
    app.get("/selected/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (!email || req.decoded.email !== email) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access" });
      }
      const query = { studentEmail: email };
      const result = await selectedCollection.find(query).toArray();
      res.send(result);
    });

    // Add to selected
    app.post("/selected", async (req, res) => {
      const selectedClass = req.body;
      const result = await selectedCollection.insertOne(selectedClass);
      res.send(result);
    });

    // Delete selected class
    app.delete("/selected/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(query);
      res.send(result);
    });

    // Save enrolled class
    app.post("/enrolledClass", async (req, res) => {
      const enrolledClass = req.body;
      const result = await enrolledClassesCollection.insertOne(enrolledClass);
      res.send(result);
    });

    // Get enrolled classes
    app.get("/enrolledClasses/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (!email || req.decoded.email !== email) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access" });
      }
      const query = { studentEmail: email };
      const result = await enrolledClassesCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    // Get enrolled class
    app.get("/enrolledClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Port listener
app.listen(port, () => {
  console.log(`Harmonic server is running on port ${port}`);
});
