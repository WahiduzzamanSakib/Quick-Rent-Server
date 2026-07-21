const express = require('express');
const app = express();
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

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

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`)
);
const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers?.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    console.log(payload);
    next();
  } catch (error) {
    console.error(error);
    return res.status(403).json({ message: "Forbidden" });
  }
};
const ownerVerify = async (req, res, next) => {
  const user = req.user;
  if (user.role !== "OWNER") {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};


async function run() {
  try {

    await client.connect();
    await client.db("admin").command({ ping: 1 });

    //api start
    const db = client.db("quickrent-Platform");
    const collection = db.collection("properties");
    const reviewCollection = db.collection("reviews");
    const favoriteCollection = db.collection("favorite")
    const userCollection = db.collection("user");
    const paymentCollection = db.collection("payment");


    //owner overview
    app.get('/dashboard/owner/overview/:email', async (req, res) => {
      const email = req.params.email;

      // owner properties
      const properties = await collection.find({
        owner: email
      }).toArray();

      // owner bookings
      const bookings = await paymentCollection.find({
        ownerEmail: email
      }).toArray();

      // total earning from totalRent
      const totalEarnings = bookings.reduce(
        (sum, item) => sum + Number(item.totalRent || 0),
        0
      );


      // monthly earnings
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthly = {};
      months.forEach(month => {
        monthly[month] = 0;
      });

      bookings.forEach(item => {
        const monthNumber = parseInt(item.checkIn.split("-")[1]);
        const month = months[monthNumber - 1];
        monthly[month] += Number(item.totalRent || 0);
      });

      const chartData = months.map(month => ({
        month,
        earnings: monthly[month]
      }));

      res.send({
        totalEarnings,
        totalProperties: properties.length,
        totalBookings: bookings.length,
        chartData
      });

    });


    //booking Payment ........
    app.post("/api/properties/booking", async (req, res) => {
      const payment = req.body;
      const newPayment = {
        ...payment,
        createdAt: new Date(),
      };
      const result = await paymentCollection.insertOne(newPayment);
      res.send(result);
    })

    // userview
    app.get('/api/properties/booking/:email', async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    app.delete('/api/properties/booking/:id', async (req, res) => {
      const id = req.params.id;
      const result = await paymentCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    })

    //ownerview
    app.get('/api/properties/all-booking/:ownerMail', async (req, res) => {
      const ownerMail = req.params.ownerMail;
      const query = { ownerEmail: ownerMail };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.patch('/api/bookings/status/:id', async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          bookingStatus: status
        }
      };

      const result = await paymentCollection.updateOne(
        filter,
        updateDoc
      );

      res.send(result);
    });

    //adminview
    app.get('/api/all-properties/booking', async (req, res) => {
      const result = await paymentCollection.find({}).toArray();
      res.send(result);
    })
    //Booking payment............


    // search
    app.get("/api/properties", async (req, res) => {
      try {
        const {
          location,
          propertyType,
          sort,
          minPrice,
          maxPrice,
        } = req.query;

        let filter = {
          status: "approved",
        };


        if (location) {
          filter.location = { $regex: location, $options: "i" };
        }


        if (propertyType) {
          filter.propertyType = propertyType;
        }


        if (minPrice || maxPrice) {
          filter.$expr = {
            $and: [
              ...(minPrice
                ? [
                  {
                    $gte: [
                      { $toDouble: "$rent" },
                      Number(minPrice),
                    ],
                  },
                ]
                : []),

              ...(maxPrice
                ? [
                  {
                    $lte: [
                      { $toDouble: "$rent" },
                      Number(maxPrice),
                    ],
                  },
                ]
                : []),
            ],
          };
        }

        let query = collection.find(filter);


        if (sort === "price_asc") {
          query = query.sort({ rent: 1 });
        }

        if (sort === "price_desc") {
          query = query.sort({ rent: -1 });
        }

        const result = await query.toArray();
        res.send(result);

      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error" });
      }
    });

    //user data
    app.get('/dashboard/admin/get-users', async (req, res) => {
      const result = await userCollection.find({}).toArray();
      res.send(result);
    });

    app.patch('/dashboard/admin/update-role/:id', async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const allowedRoles = ["TENANT", "ADMIN", "OWNER"];
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: role } }
      );
      res.json({
        result
      });
    });


    //favorite
    app.delete('/dashboard/tenant/favorite/:id', async (req, res) => {
      const id = req.params.id;
      const result = await favoriteCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.get('/dashboard/tenant/favorite/:email', async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await favoriteCollection.find(query).toArray();
      res.json(result);
    });

    app.post('/dashboard/tenant/favorite', async (req, res) => {
      const favorite = req.body;
      const newFavorite = {
        ...favorite,
        createdAt: new Date(),
      };
      const result = await favoriteCollection.insertOne(newFavorite);
      res.send(result);
    });

    // review
    app.get('/dashboard/single-properties/review', async (req, res) => {
      const result = await reviewCollection
        .find({ rating: { $gte: 3 } })
        .sort({ createdAt: -1 })
        .limit(4)
        .toArray();

      res.send(result);
    });

    app.post('/dashboard/single-properties/review', async (req, res) => {
      const review = req.body;
      const newReview = {
        ...review,
        createdAt: new Date(),
      };
      const result = await reviewCollection.insertOne(newReview);
      res.send(result);
    });

    //id base data/details
    app.get('/dashboard/signle-prperties/:id', async (req, res) => {
      const propertyId = req.params.id;
      const query = { _id: new ObjectId(propertyId) };
      const result = await collection.findOne(query);
      res.send(result);
    });


    //user base property
    app.get('/dashboard/owner/get-properties/:email', async (req, res) => {
      const email = req.params.email;
      const query = { owner: email };
      const result = await collection.find(query).toArray();
      res.json(result);
    });


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

    //mongodb limit
    app.get('/dashboard/approved-limit/get-properties', async (req, res) => {
      const result = await collection
        .find({ status: "approved" })
        .limit(6)
        .toArray();

      res.send(result);
    });

    //recenly add properties
    app.get('/dashboard/recent-properties', async (req, res) => {
      try {
        const result = await collection
          .find({ status: "approved" })
          .sort({ createdAt: -1 }) // newest first
          .limit(3)
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    //all property
    app.get('/dashboard/admin/get-properties', async (req, res) => {
      const result = await collection.find({}).toArray();
      res.send(result);
    });

    app.post('/dashboard/owner/add-property', verifyToken, ownerVerify, async (req, res) => {
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