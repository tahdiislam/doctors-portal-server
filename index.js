const express = require("express");
const cors = require("cors");
require("dotenv").config()
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

async function run(){
    try{
        const AppointmentOptions = client.db("doctorsPortal").collection("appointmentOptions")

        // get all appointments options
        app.get("/appointment-options", async(req, res) => {
            const query = {};
            const cursor = AppointmentOptions.find(query);
            const result = await cursor.toArray()
            res.send({result})
        })
    }
    finally{

    }
}

run().catch(console.log)

// default api
app.get("/", (req, res) => {
  res.send("Doctors portal server is running");
});

app.listen(port, () => {
  console.log(`Doctors portal is runnign on port ${port}`);
});
