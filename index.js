const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
// middle wire
app.use(express.json());

//connect with db

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.rgyxe1r.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// custom middleware form jwt verify
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    // appointment options collection
    const AppointmentOptions = client
      .db("doctorsPortal")
      .collection("appointmentOptions");

    // bookings collection
    const Bookings = client
      .db("doctorsPortal")
      .collection("bookingCollections");

    // doctor's collection
    const Doctors = client.db("doctorsPortal").collection("doctorsCollection");

    // users collection
    const Users = client.db("doctorsPortal").collection("usersCollection");

    // custom middleware
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const filter = { email: decodedEmail };
      const user = await Users.findOne(filter);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //stipe
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        "payment_method_types": ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // get jwt
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await Users.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.TOKEN_SECRET, {
          expiresIn: "1h",
        });
        return res.send({ token });
      }
      return res.send({ token: "" });
    });

    // get all appointments options
    app.get("/appointment-options", async (req, res) => {
      const date = req.query.date;
      const query = {};
      const cursor = AppointmentOptions.find(query);
      const result = await cursor.toArray();
      const bookingQuery = { appointmentDate: date };
      const alreadyBooked = await Bookings.find(bookingQuery).toArray();
      result.forEach((option) => {
        const bookedOption = alreadyBooked.filter(
          (book) => book.treatment === option.name
        );
        const bookedSlots = bookedOption.map((book) => book.slot);
        const remainingSlots = option.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        option.slots = remainingSlots;
      });
      res.send({ result });
    });

    // get appointment specialty
    app.get("/appointment-specialty", async (req, res) => {
      const query = {};
      const result = await AppointmentOptions.find(query)
        .project({ name: 1 })
        .toArray();
      res.send({ result });
    });

    // get all users
    app.get("/users", async (req, res) => {
      const query = {};
      const users = await Users.find(query).toArray();
      res.send({ users });
    });

    // get all doctors
    app.get("/doctors", verifyJWT, async (req, res) => {
      const query = {};
      const doctors = await Doctors.find(query).toArray();
      res.send({ doctors });
    });

    // check user is admin
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await Users.findOne(query);
      res.send({ isAdmin: user.role === "admin" });
    });

    // make user admin
    app.put("/users/admin/:id", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await Users.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updateUser = {
        $set: {
          role: "admin",
        },
      };
      const options = { upsert: true };
      const result = await Users.updateOne(filter, updateUser, options);
      res.send({ result });
    });

    // post doctor's
    app.post("/doctors", verifyJWT, async (req, res) => {
      const doctor = req.body;
      const result = await Doctors.insertOne(doctor);
      res.send({ result });
    });

    // post booking
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const query = {
        appointmentDate: booking.appointmentDate,
        treatment: booking.treatment,
        email: booking.email,
      };
      const alreadyBooked = await Bookings.find(query).toArray();
      if (alreadyBooked.length) {
        const message = `You already have a booking on ${booking.appointmentDate}`;
        return res.send({ acknowledged: false, message });
      }
      const result = await Bookings.insertOne(booking);
      res.send({ result });
    });

    // get booking by specific email
    app.get("/bookings", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const email = req.query.email;
      if (decodedEmail !== email) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const query = { email: email };
      const result = await Bookings.find(query).toArray();
      res.send({ result });
    });

    // get single booking
    app.get("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await Bookings.findOne(query);
      res.send({ result });
    });

    // add new field in appointment collection
    // app.get("/pricefield", async(req, res) => {
    //   const query = {};
    //   const option = {upsert: true};
    //   const updateField = {
    //     $set: {
    //       price: 99,
    //     }
    //   };
    //   const result = await AppointmentOptions.updateMany(query, updateField, option)
    //   res.send({result})
    // })

    // post user
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const result = await Users.insertOne(user);
      res.send({ result });
    });

    // delete doctor
    app.delete("/doctors/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await Doctors.deleteOne(query);
      res.send({ result });
    });
  } finally {
  }
}

run().catch(console.log);

// default api
app.get("/", (req, res) => {
  res.send("Doctors portal server is running");
});

app.listen(port, () => {
  console.log(`Doctors portal is running on port ${port}`);
});
