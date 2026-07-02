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


    //id base data
    // app.get('/dashboard/owner/get-properties-id/:id', async (req, res) => {
    //   const propertyId = req.params.id;
    //   const query = { _id: new ObjectId(propertyId) };
    //   const result = await collection.findOne(query);
    //   res.send(result);
    // });
    //id base data

    //user base property
    app.get('/dashboard/owner/get-properties/:email', async (req, res) => {
      const email = req.params.email;
      const query = { owner: email };
      const result = await collection.find(query).toArray();
      res.json(result);
    });
    //user base property

    // edit property
    app.patch("/dashboard/owner/edit-property/:id", async (req, res) => {
      const propertyId = req.params.id;
      const updateData = {};
      Object.keys(req.body).forEach((key) => {
        const value = req.body[key];
        if (value !== undefined && value !== "") {
          updateData[key] = value;
        }
      });
      const result = await collection.updateOne(
        { _id: new ObjectId(propertyId) },
        { $set: updateData }
      );
      res.json(result);
    });

    //delete property
    app.delete("/dashboard/owner/delete-property/:id", async (req, res) => {
      const propertyId = req.params.id;
      const result = await collection.deleteOne({ _id: new ObjectId(propertyId) });
      res.json(result);
    });

    //approve and reject property
    app.patch("/dashboard/owner/approve-reject-property/:id", async (req, res) => {
      try {
        const propertyId = req.params.id;
        const { status } = req.body;

        if (!["approved", "rejected"].includes(status)) {
          return res.status(400).json({ message: "Invalid status" });
        }
        const result = await collection.updateOne(
          { _id: new ObjectId(propertyId) },
          {
            $set: { status }
          }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Property not found" });
        }
        res.json({
          message: "Status updated successfully",
          result
        });

      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
      }
    });

//approved data
app.get('/dashboard/approved/get-properties', async (req, res) => {
  const result = await collection.find({ status: "approved" }).toArray();
  res.send(result);
});



    //all property
    app.get('/dashboard/admin/get-properties', async (req, res) => {
      const result = await collection.find({}).toArray();
      res.send(result);
    });
    //all property


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