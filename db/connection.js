require('dotenv').config();

const mongoose=require("mongoose");

mongoose.connect(process.env.DB_URI ,{
    useNewUrlParser:true,
    useUnifiedTopology:true
}).then(()=>{
    console.log("Connection is established");
}).catch((e)=>{
    console.log(e)
    console.log("No Connection Found");
});
