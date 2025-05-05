const express = require("express");
const port = 3008 | process.env.PORT;
const app = express();


module.exports = {
    startServer: (port) => {
        app.get("/", (req, res) => {
            res.send(`Server is running on port ${port}`);
        });

        app.listen(port,() =>{
            console.log(`Keep Alive Server started on port ${port}`);
        });

        return app;

    }
} 
