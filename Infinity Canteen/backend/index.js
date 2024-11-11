import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import pgSession from "connect-pg-simple";

const saltRounds = 10;
const port = 3000;

const app = express();


app.use(bodyParser.urlencoded({ extended: true }));



const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "canteen",
    password: "aloksingh9",
    port: 5432,
});
db.connect();


app.use(session({
    store: new (pgSession(session))({
        conString: "postgres://postgres:aloksingh9@localhost:5432/canteen",
        tableName: "user_sessions",
        createTableIfMissing: true,
    }),
    secret: "aaltufaltu",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
    },
}));

app.get("/", (req, res) => {
    res.render("home.ejs");
})

app.get("/ownerRegister", (req, res) => {
    res.render("ownerReg.ejs");
})

app.get("/studentRegister", (req, res) => {
    res.render("studentReg.ejs");
})

app.get("/ownerLogin", (req, res) => {
    res.render("ownerLogin.ejs");
})

app.get("/studentLogin", (req, res) => {
    res.render("studentLogin.ejs");
})

app.post("/ownerRegister", async (req, res) => {
    const email = req.body.email;
    const username = req.body.username;
    const password = req.body.password;
    try {
        var result = await db.query("select * from owner where email = $1", [email]);
        console.log(result);
        if (result.rows.length == 0) {
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if (err) {
                    console.log("Error hashing password", err);
                }
                else {

                    //session creation
                    req.session.user = {
                        type: "owner",
                        email: email,
                        username: username,
                    };


                    result = await db.query("insert into owner(name , email , password) values ($1,$2,$3) returning *", [username, email, hash]);
                    console.log(result.rows);
                    const sanitizedEmail = email.replace(/[^a-zA-Z0-9_]/g, "_");
                    await db.query(`CREATE TABLE if not exists ${sanitizedEmail} (name VARCHAR(255) NOT NULL,price int NOT NULL,available BOOLEAN NOT NULL)`);
                    const food = await db.query(`Select * from ${sanitizedEmail}`);
                    console.log(food.rows);
                    res.render("owner.ejs", { naam: username, foodItems: food.rows });
                }
            })
        }
        else {
            res.redirect("/ownerLogin");
        }
    } catch (error) {
        console.log("Sorry guys", error.message);
    }
})


app.post("/studentRegister", async (req, res) => {
    const email = req.body.email;
    const username = req.body.username;
    const password = req.body.password;
    try {
        var result = await db.query("select * from student where email = $1", [email]);
        if (result.rows.length == 0) {
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if (err) {
                    console.log("Error hashing password", err);
                }
                else {
                    req.session.user = {
                        type: "student",
                        email: email,
                        username: username,
                    };
                    result = await db.query("insert into student(name , email , password) values ($1,$2,$3) returning *", [username, email, hash]);
                    console.log(result.rows);

                    var restaurants = await db.query("select * from owner");
                    console.log(restaurants.rows);
                    res.render("students.ejs", { naam: username, restaurantList: restaurants.rows });
                }
            })
        }
        else {
            res.redirect("/studentLogin");
        }
    } catch (error) {
        console.log("Sorry guys", error.message);
    }
})

app.post("/ownerLogin", async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    try {
        var result = await db.query("Select * from owner where email = $1", [email]);
        if (result.rows.length != 0) {
            const storedHashedPassword = result.rows[0].password;
            bcrypt.compare(password, storedHashedPassword, async (err, sahiHai) => {
                if (err) {
                    console.log(err.message);
                }
                else if (sahiHai) {
                    req.session.user = {
                        type: "owner",
                        email: result.rows[0].email,
                        username: result.rows[0].name,
                    };
                    const sanitizedEmail = email.replace(/[^a-zA-Z0-9_]/g, "_");
                    await db.query(`CREATE TABLE if not exists ${sanitizedEmail} (name VARCHAR(255) NOT NULL,price int NOT NULL,available BOOLEAN NOT NULL)`);
                    const food = await db.query(`Select * from ${sanitizedEmail}`);
                    //console.log(food.rows);


                    res.render("owner.ejs", { naam: result.rows[0].name, foodItems: food.rows });
                }
                else {
                    res.redirect("/ownerLogin");
                }
            })
        }
        else {
            res.redirect("/ownerRegister")
        }
    } catch (error) {
        console.log("Sorry Guys", error.message);
    }

})


app.post("/studentLogin", async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    try {
        var result = await db.query("Select * from student where email = $1", [email]);
        if (result.rows.length != 0) {
            const storedHashedPassword = result.rows[0].password;
            bcrypt.compare(password, storedHashedPassword, async (err, sahiHai) => {
                if (err) {
                    console.log(err.message);
                }
                else if (sahiHai) {
                    result = await db.query("select name from student where email = $1", [email]);
                    req.session.user = {
                        type: "student",
                        email: email,
                        username: result.rows[0].name,
                    };
                    var restaurants = await db.query("select * from owner");
                    //console.log(restaurants.rows);
                    res.render("students.ejs", { naam: result.rows[0].name, restaurantList: restaurants.rows })
                }
                else {
                    res.redirect("/studentLogin");
                }
            })
        }
        else {
            res.redirect("/studentRegister")
        }
    } catch (error) {
        console.log("Sorry Guys", error.message);
    }

})


//Route for adding food items in the menu of restaurant
app.post("/addFood", async (req, res) => {
    const foodName = req.body.foodItem;
    const foodPrice = req.body.price;
    const email = req.session.user.email;
    const username = req.session.user.username;
    try {
        const sanitizedEmail = email.replace(/[^a-zA-Z0-9_]/g, "_");
        await db.query(`insert into ${sanitizedEmail} (name , price , available) values ($1,$2,$3)`, [foodName, foodPrice, true]);
        var result = await db.query(`select * from ${sanitizedEmail}`);
        var food = result.rows;
        console.log(food);
        console.log(username);
        res.render("owner.ejs", { naam: username, foodItems: food });
    } catch (error) {
        console.log(error);
    }
})

//to list food items of selected restaurant
app.get("/foods/:id", async (req, res) => {
    var restaurantId = req.params.id;
    //console.log(restaurantId);
    try {
        var result = await db.query("select email from owner where id = $1", [restaurantId]);
        const email = result.rows[0].email;
        const sanitizedEmail = email.replace(/[^a-zA-Z0-9_]/g, "_");
        result = await db.query(`select * from ${sanitizedEmail}`);
        // console.log(result.rows);
        //console.log(req.session.user); 
        res.render("addToCart.ejs", { foodItems: result.rows, restaurantId: req.params.id });
    } catch (error) {
        console.log(error);
    }
})

//to get the bill paid
app.post("/addTocart/:params", async (req, res) => {
    var restaurantId = req.params.params;
    try {
        var sanitizedEmail = req.session.user.email.replace(/[^a-zA-Z0-9_]/g, "_");
        // Create user's cart table
        const createCartTableQuery = `
            CREATE TABLE IF NOT EXISTS ${sanitizedEmail}cart (
                id SERIAL PRIMARY KEY,
                restaurant_id INT NOT NULL,
                food_name VARCHAR(255) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                quantity INT NOT NULL
            )
        `;
        await db.query(createCartTableQuery);

        // Create restaurant-specific orders table
        const createOrdersTableQuery = `
            CREATE TABLE IF NOT EXISTS orders${restaurantId} (
                order_id SERIAL PRIMARY KEY,
                food_name VARCHAR(255) NOT NULL,
                user_email VARCHAR(255) NOT NULL
            )
        `;
        await db.query(createOrdersTableQuery);

        console.log(req.body);

        var result = req.body;

        for (const [key, quantity] of Object.entries(result)) {
            const [foodName, price] = key.split(":");
            const priceValue = parseFloat(price);
            const quantityValue = parseInt(quantity, 10);

            if (quantityValue > 0) {
                await db.query(
                    `INSERT INTO ${sanitizedEmail}cart (restaurant_id, food_name, price, quantity) VALUES ($1, $2, $3, $4)`,
                    [restaurantId, foodName, priceValue, quantityValue]
                );
            }
        }
        for (const [key, quantity] of Object.entries(result)) {
            const [foodName, price] = key.split(":");
            const quantityValue = parseInt(quantity, 10);

            if (quantityValue > 0) {
                await db.query(
                    `INSERT INTO orders${restaurantId} (food_name, user_email) VALUES ($1, $2)`,
                    [foodName, req.session.user.email]
                );
            }
        }

        const query = `
            SELECT SUM(price * quantity) AS total_bill
            FROM ${sanitizedEmail}cart
        `;

        result = await db.query(query);

        const totalBill = result.rows[0].total_bill;
        result = await db.query(`select * from ${sanitizedEmail}cart`);
        console.log(result.rows);
        res.render("cart.ejs", { total: totalBill, foodItems: result.rows });

    } catch (error) {
        console.log(error);
    }

})

app.get("/cart", async (req, res) => {
    const sanitizedEmail = req.session.user.email.replace(/[^a-zA-Z0-9_]/g, "_");
    try {
        
        const query = `
        SELECT SUM(price * quantity) AS total_bill
        FROM ${sanitizedEmail}cart
    `;

    var result = await db.query(query);

    const totalBill = result.rows[0].total_bill;
    try {
        result = await db.query(`select * from ${sanitizedEmail}cart`);
        console.log(result.rows);
        res.render("cart.ejs", { total: totalBill, foodItems: result.rows });
    } catch (error) {
        console.log(error);
        res.render("cart.ejs");
    }
    } catch (error) {
        console.log(error);
        res.render("cart.ejs");
    }
});


app.get("/pendingOrders" , async (req,res) => {
    
    try {

        if(req.session.user.type == "student")
        {
            res.send("You are not authorised to acces this page")
        }
        else if(req.session.user.type == "owner")
        {
            var result =  await db.query("select id from owner where email = $1",[req.session.user.email]);
            try {
                result = await db.query(`select * from orders${result.rows[0].id}`)
                res.render("order.ejs",{orders : result.rows});
            } catch (error) {
                console.log(error);
                res.render("order.ejs");
            }
         
        }
        
    } catch (error) {
        console.log(error);
    }
})

app.listen(port, () => {
    console.log(`is port no ${port} pe sun rha hoon bhai!`);
});