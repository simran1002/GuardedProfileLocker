require("dotenv").config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const { connectDB } = require("./db/connection");
const User = require('./models/user');

const app = express();
const PORT = 3000;

app.use(express.json());

// Middleware to check if the user making the request is an Admin
const isAdmin = (req, res, next) => {
  const userId = req.params.userId; // Assuming userId is extracted from the request parameters
  const user = users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check if the user making the request is an Admin
  if (admins.includes(user.id)) {
    req.userRole = 'Admin';
    return next();
  } else {
    return res.status(403).json({ error: 'Permission denied. Admin access required.' });
  }
};

// Middleware to check if the user making the request is the owner of the account
const isOwner = (req, res, next) => {
  const userId = req.params.userId; // Assuming userId is extracted from the request parameters
  const user = users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check if the user making the request is the owner or an Admin
  if (req.userRole === 'Admin' || userId === req.user.id) {
    return next();
  } else {
    return res.status(403).json({ error: 'Permission denied. You can only modify your own details.' });
  }
};

// Function to generate a JWT token
const generateToken = (userId, role) => {
  const token = jwt.sign({ userId, role }, 'your-secret-key', { expiresIn: '1h' });
  return token;
};


// Multer storage configuration for handling profile images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/profile-images'); // Destination folder for profile images
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Route to upload a profile image
app.post('/uploadProfileImage/:userId', isOwner, upload.single('profileImage'), (req, res) => {
  try {
    const user = users.find(u => u.id === req.params.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.file) {
      // Update the user's profile image URL in the database
      user.profileImage = req.file.path;

      return res.status(200).json({ message: 'Profile image uploaded successfully', imageUrl: req.file.path });
    } else {
      return res.status(400).json({ error: 'No file uploaded' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to retrieve a profile image
app.get('/profileImage/:userId', (req, res) => {
  try {
    const user = users.find(u => u.id === req.params.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.profileImage) {
      return res.sendFile(user.profileImage);
    } else {
      return res.status(404).json({ error: 'Profile image not found' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to create an Admin
app.post('/createAdmin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the user already exists
    if (users.some(user => user.email === email)) {
      return res.status(409).json({ error: 'User already exists.' });
    }

    // Encrypt the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new admin
    const newAdmin = {
      id: Math.random().toString(36).substr(2, 9), // Generate a random ID for the admin
      email,
      password: hashedPassword,
      role: 'Admin', // Assign the 'Admin' role
    };

    // Store the admin in your database or in-memory storage
    admins.push(newAdmin);

    return res.status(201).json({ message: 'Admin created successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route accessible only by Admins
app.get('/adminDetails', isAdmin, (req, res) => {
  // Accessible only by Admins
  return res.status(200).json({ message: 'Admin details accessed successfully' });
});

// Route accessible by the owner and Admins
app.get('/userDetails/:userId', isOwner, (req, res) => {
  // Accessible by the owner and Admins
  return res.status(200).json({ message: 'User details accessed successfully' });
});


app.post('/login', async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    // Find user by email or phone
    const user = findUser(emailOrPhone);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate a JWT token for the authenticated user
    const token = generateToken(user.id, user.role);

    return res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.put('/modify/:userId', isOwner, async (req, res) => {
  try {
    const { name, profileImage } = req.body;

    // Modify the user's name and profile image
    const user = users.find(u => u.id === req.params.userId);
    user.name = name;
    user.profileImage = profileImage;

    return res.status(200).json({ message: 'User details modified successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Function to find a user by email or phone
const findUser = (emailOrPhone) => {
  return users.find(user => user.email === emailOrPhone || user.phone === emailOrPhone);
};

app.delete('/delete/:userId', isOwner, (req, res) => {
  try {
    // Delete the user's account
    const userIndex = users.findIndex(u => u.id === req.params.userId);

    if (userIndex !== -1) {
      users.splice(userIndex, 1);
      return res.status(200).json({ message: 'User account deleted successfully' });
    } else {
      return res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});



// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
