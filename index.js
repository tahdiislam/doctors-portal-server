const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middle wire
app.use(cors());
app.use(express.json());

//connect with db

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.rgyxe1r.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

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
    app.get("/bookings", async(req, res) => {
      const email = req.query.email;
      const query = {email: email}
      const result = await Bookings.find(query).toArray()
      res.send({result})
    })
  } finally {
  }
}

run().catch(console.log);

// default api
app.get("/", (req, res) => {
  res.send("Doctors portal server is running");
});

app.listen(port, () => {
  console.log(`Doctors portal is runnign on port ${port}`);
});
