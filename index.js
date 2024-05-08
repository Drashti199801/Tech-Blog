// Import Dependencies
const express = require("express");
const { check, validationResult } = require("express-validator");
const upload = require("express-fileupload");
const path = require("path");
var myApp = express();
const session = require("express-session");

// Setup Database Connection
const mongoose = require("mongoose");
mongoose.connect("mongodb://localhost:27017/project");

const Admin = mongoose.model("Admin", {
  username: String,
  password: String,
});

const blogs = mongoose.model("blogs", {
  title: String,
  content: String,
  imgName: String,
  imgType: String,
  imgSize: Number,
});
// Setup Session Parameters
myApp.use(
  session({
    secret: "thisisdrashtisecretcode",
    resave: false,
    saveUninitialized: true,
  })
);

// Express Body-Parser
myApp.use(express.urlencoded({ extended: true }));

// Set path to public and views folder
myApp.set("views", path.join(__dirname, "views"));
myApp.use(express.static(__dirname + "/public/"));
myApp.use("/public/images/", express.static("./public/images/"));
myApp.set("view engine", "ejs");
myApp.use(upload());

// Set Different Routes (Pages)
myApp.get("/", function (req, res) {
  res.render("home");
});

myApp.get("/about", function (req, res) {
  res.render("about");
});
myApp.get("/teams", function (req, res) {
  res.render("teams");
});
myApp.get("/contact", function (req, res) {
  res.render("contact");
});
// Login Page - Post Method
myApp.post("/login", (req, res) => {
  // Read Values from Form
  var user = req.body.username;
  var pass = req.body.password;
  console.log(`Username is: ${user}`);
  console.log(`Password is: ${pass}`);

  //Validate Form Values with Database
  Admin.findOne({ username: user, password: pass })
    .then((admin) => {
      console.log(`Admin: ${admin}`);
      if (admin) {
        // Create a Session for Current User
        req.session.username = admin.username;
        req.session.userLoggedIn = true;
        res.redirect("dashboard");
      } else {
        // Session Not Created - Incorrect Login
        res.render("home", { error: "Sorry Login Failed. Please Try Again!" });
      }
    })
    .catch((err) => {
      console.log(`Error: ${err}`);
    });
});

myApp.get("/dashboard", function (req, res) {
  const username = req.session.username;
  if(req.session.userLoggedIn)
  {
  blogs
    .find({})
    .then((blogData) => {
      res.render("dashboard", { blogData: blogData, username: username });
    })
    .catch((err) => {
      console.log("Error fetching blogs:", err);
      res.status(500).send("Internal Server Error");
    });
  }else{
    res.redirect("/");
  }
});

myApp.get("/addpages", function (req, res) {
  res.render("addpages");
});

myApp.post(
  "/savedata",
  [
    check("title", "Page title is required").notEmpty(),
    check("content", "Content is required").notEmpty(),
  ],
  function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("addpages", { errors: errors.array() });
    }

    var title = req.body.title;
    var image = req.files.heroImage;
    var imgName = image.name;
    var imgPath = "public/images/" + imgName;
    var content = req.body.content;

    image.mv(imgPath, (err) => {
      if (err) {
        console.log(`Error: ${err}`);
        res.send(err);
      } else {
        var blogData = {
          title: title,
          imgName: imgName,
          imgType: image.mimetype,
          imgSize: image.size,
          content: content,
        };

        var blogPage = new blogs(blogData);
        blogPage
          .save()
          .then(() => {
            console.log("File data saved in database!");
            res.redirect("/dashboard");
          })
          .catch((err) => {
            res.send(err);
          });
      }
    });
  }
);

myApp.get("/pageslist", function (req, res) {
  blogs
    .find({})
    .then((pageslist) => {
      res.render("pageslist", { pageslist: pageslist });
    })
    .catch((err) => {
      res.status(500).send("Internal Server Error");
    });
});

myApp
  .route("/editpages/:pageid")
  .get(function (req, res) {
    // Check if user is logged in
    if (req.session.userLoggedIn) {
      // Find page details by ID
      blogs
        .findById({ _id: req.params.pageid })
        .then((page) => {
          res.render("editpages", { page: page });
        })
        .catch((err) => {
          res.status(500).send("Internal server error");
        });
    } else {
      // If user is not logged in, redirect to login page
      res.redirect("/login");
    }
  })
  .post(function (req, res) {
    // Check if user is logged in
    if (req.session.userLoggedIn) {
      const newTitle = req.body.title;
      const newImage = req.files.heroImage;
      const newImgName = newImage.name;
      const newImgPath = "public/images/" + newImgName;
      const newContent = req.body.content;

      newImage.mv(newImgPath, (err) => {
        if (err) {
          return res.status(500).send("Internal server error");
        } else {
          // If image is moved successfully, update the database
          blogs
            .findByIdAndUpdate(
              req.params.pageid, // page ID to update
              {
                title: newTitle,
                content: newContent,
                imgName: newImgName,
                imgType: newImage.mimetype,
                imgSize: newImage.size,
              },
              { new: true } // To return the updated document
            )
            .then((updatedPage) => {
              res.redirect("/dashboard");
            })
            .catch((err) => {
              res.status(500).send("Internal Server Error");
            });
        }
      });
    } else {
      // If user is not logged in, redirect to login page
      res.redirect("/login");
    }
  });

myApp.get("/deletepages/:pageid", (req, res) => {
  // Check if session exists
  if (req.session.userLoggedIn) {
    // Read Object Id of Database Document
    // Find blog post by ID and delete it from the database
    blogs
      .findByIdAndDelete({ _id: req.params.pageid })
      .then((deletedBlog) => {
        if (deletedBlog) {
          // If blog post is deleted successfully, redirect to '/pageslist' route
          res.redirect("/pageslist");
        } else {
          // If blog post is not found, render 'pageslist' view with error message
          res.render("pageslist", {
            message: "Something Went Wrong. Blog Post Not Deleted!",
          });
        }
      })
      .catch((err) => {
        res.status(500).send("Internal Server Error");
      });
  } else {
    // If session doesn't exist, redirect to login page
    res.redirect("/login");
  }
});

// Logout Page
myApp.get("/logout", (req, res) => {
  req.session.username = "";
  req.session.userLoggedIn = false;
  res.render("home", { error: "Logout Successfully!" });
});

// Execute Website Using Port Number for Localhost
myApp.listen(8080);
console.log(
  "Website Executed Successfully... Open Using http://localhost:8080/"
);
