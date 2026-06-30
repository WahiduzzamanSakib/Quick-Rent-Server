const express = require('express');
const app = express();
const cors = require('cors');

const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();

const uri = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


// mongodb

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {

    await client.connect();
    await client.db("admin").command({ ping: 1 });

    //api start
    const db = client.db("quickrent-Platform");
    const collection = db.collection("properties");


    app.post('/dashboard/owner/add-property', async (req, res) => {
      const property = req.body;
      const result = await collection.insertOne(property);
      res.send(result);
    });

    //api closed
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

    // await client.close();
  }
}
run().catch(console.dir);

// mongodb

app.get('/', (req, res) => {
  res.send('Server is running fine!');
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});