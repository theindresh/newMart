const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const port = 2025;

app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect("mongodb+srv://AnandPrakash:nP8l4TG808kD9vJ1@stockscrapper.crwo3.mongodb.net/", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB connected"))
.catch((err) => console.log("MongoDB connection error: ", err));

const storage = multer.diskStorage({
  destination: './upload/images',
  filename: (req, file, cb) => {
    return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
  }
});

const upload = multer({ storage: storage });

// Route for Images folder
app.use('/images', express.static('upload/images'));

// Middleware to fetch user from token
const fetchuser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    return res.status(401).send({ errors: "Please authenticate using a valid token" });
  }
  try {
    const data = jwt.verify(token, "secret_ecom");
    req.user = data.user;
    next();
  } catch (error) {
    res.status(401).send({ errors: "Please authenticate using a valid token" });
  }
};

// Schema for creating user model
const Users = mongoose.model("Users", {
  name: { type: String },
  email: { type: String, unique: true },
  password: { type: String },
  cartData: { type: Object },
  date: { type: Date, default: Date.now() },
});

// Schema for creating Product
const Product = mongoose.model("Product", {
  id: { type: Number, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  category: { type: String, required: true },
  new_price: { type: Number },
  old_price: { type: Number },
  date: { type: Date, default: Date.now },
  available: { type: Boolean, default: true },
});

// ROOT API Route For Testing
app.get("/", (req, res) => {
  res.send("Root");
});

// Login endpoint
app.post('/login', async (req, res) => {
  console.log("Login attempt");
  let success = false;
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        user: {
          id: user.id
        }
      }
      success = true;
      console.log("User logged in:", user.id);
      const token = jwt.sign(data, 'secret_ecom');
      res.json({ success, token });
    } else {
      return res.status(400).json({ success: success, errors: "Please try with correct email/password" })
    }
  } else {
    return res.status(400).json({ success: success, errors: "Please try with correct email/password" })
  }
});

// Signup endpoint
app.post('/signup', async (req, res) => {
  console.log("Signup attempt");
  let success = false;
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({ success: success, errors: "Existing user found with this email" });
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }
  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });
  await user.save();
  const data = {
    user: {
      id: user.id
    }
  }
  const token = jwt.sign(data, 'secret_ecom');
  success = true;
  res.json({ success, token })
});

// Get all products
app.get("/allproducts", async (req, res) => {
  let products = await Product.find({});
  console.log("All Products fetched");
  res.send(products);
});

// Get new collections
app.get("/newcollections", async (req, res) => {
  let products = await Product.find({});
  let newCollections = products.slice(-8);
  console.log("New Collections fetched");
  res.send(newCollections);
});

// Get popular in women
app.get("/popularinwomen", async (req, res) => {
  let products = await Product.find({ category: "women" });
  let popularInWomen = products.slice(0, 4);
  console.log("Popular In Women fetched");
  res.send(popularInWomen);
});

// Get related products
app.post("/relatedproducts", async (req, res) => {
  console.log("Related Products request");
  const { category } = req.body;
  const products = await Product.find({ category });
  const relatedProducts = products.slice(0, 4);
  res.send(relatedProducts);
});

// Add to cart
app.post('/addtocart',fetchuser, async (req, res) => {
  console.log(req.body);
  
  console.log("Add to cart request");
  let userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
  res.send("Added to cart")
});

// Remove from cart
app.post('/removefromcart', fetchuser,async (req, res) => {
  console.log("Remove from cart request");
  let userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0) {
    userData.cartData[req.body.itemId] -= 1;
  }
  await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
  res.send("Removed from cart");
});

// Get cart
app.post('/getcart',fetchuser, async (req, res) => {
  console.log("Get cart request");
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

// Add product
app.post("/addproduct", upload.single('product'), async (req, res) => {
  console.log("Add product request");
  console.log("Request Body:", req.body);
  console.log("Uploaded File:", req.file);

  if (!req.file) {
    return res.status(400).json({ success: false, message: "No image uploaded" });
  }

  const fullImageUrl = `${req.protocol}://${req.get('host')}/images/${req.file.filename}`;

  let products = await Product.find({});
  let id = products.length > 0 ? products[products.length - 1].id + 1 : 1;

  const product = new Product({
    id: id,
    name: req.body.name,
    description: req.body.description,
    image: fullImageUrl,
    category: req.body.category,
    new_price: req.body.new_price,
    old_price: req.body.old_price,
  });

  try {
    await product.save();
    console.log("Product Saved:", product);
    res.json({ success: true, name: req.body.name, product: product });
  } catch (error) {
    console.error("Error saving product:", error);
    res.status(500).json({ success: false, message: "Error saving product", error: error.message });
  }
});

// Remove product
app.post("/removeproduct", async (req, res) => {
  console.log("Remove product request");
  try {
    await Product.findOneAndDelete({ id: req.body.id });
    console.log("Product removed:", req.body.id);
    res.json({ success: true, message: "Product removed successfully" })
  } catch (error) {
    console.error("Error removing product:", error);
    res.status(500).json({ success: false, message: "Error removing product", error: error.message });
  }
});

// Starting Express Server
app.listen(port, (error) => {
  if (!error) {
    console.log("Server Running on port " + port);
  } else {
    console.log("Error starting server: ", error);
  }
});