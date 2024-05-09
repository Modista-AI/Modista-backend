
// import { ChatOpenAI } from "@langchain/openai";
// import { HumanMessage } from "@langchain/core/messages";

// const chat = new ChatOpenAI({
//   modelName: "gpt-4-vision-preview",
//   maxTokens: 1024,
//   openAIApiKey: "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", // In Node.js defaults to process.env.OPENAI_API_KEY

// });


// const hostedImageMessage = new HumanMessage({
//   content: [
//     {
//       type: "text",
//       text: "You are an AI fashion designer with expertise in analyzing fashion items. Your role is to examine uploaded images of clothing and catalog them according to specific attributes. For each item, provide a detailed description in the following standardized format:\n\n- **Style:** Describe the general style of the clothing (e.g., casual, formal, sporty).\n- **Color:** Specify the primary and any notable secondary colors.\n- **Material:** Identify the material(s) the clothing is made from.\n- **Occasions:** Suggest suitable occasions for wearing the item (e.g., everyday wear, formal events, outdoor activities).\n- **Unique Features:** Note any unique features or patterns (e.g., embroidery, prints, cuts).\n- **Recommended Combinations:** Suggest other types of clothing or accessories that would pair well with this item.\n\nThis structured approach will help us create a comprehensive and searchable database of fashion items, enabling us to efficiently match clothing in the future based on users' needs and preferences.",
//     },
//     {
//       type: "image_url",
//       image_url: "https://i.pinimg.com/564x/18/34/87/183487e48ab12a1a47830348af26247f.jpg",
//     },
//   ],
// });

// const res2 = await chat.invoke([hostedImageMessage]);
// console.log({ res2 });




import express from "express";
import mongoose from "mongoose";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { promisify } from "util";
import { pipeline } from "stream";
import cors from "cors";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";

dotenv.config();

const mongoURI = "mongodb+srv://agatenashons:yt4WXrBcQuel4ovj@cluster0.yz8zuwc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // Replace with your actual MongoDB URI

await mongoose.connect(mongoURI, {
  serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
  socketTimeoutMS: 45000, // Maintain as is
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Clothing Schema (unchanged but might add a reference to User)
const clothingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Reference to User
  style: String,
  color: String,
  material: String,
  occasions: String,
  uniqueFeatures: String,
  recommendedCombinations: String,
  imageUrl: String,
}, { timestamps: true });
const Clothing = mongoose.model('Clothing', clothingSchema);

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  closet: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Clothing' }], // Reference to multiple Clothing
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const app = express();
const port = 3000;



app.use(express.json());


const GOOGLE_OAUTH_URL = process.env.GOOGLE_OAUTH_URL;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// const GOOGLE_CALLBACK_URL = "http%3A//localhost:3000/google/callback";
const GOOGLE_CALLBACK_URL = "https%3A//modista-backend.vercel.app/google/callback";

const GOOGLE_OAUTH_SCOPES = [

"https%3A//www.googleapis.com/auth/userinfo.email",

"https%3A//www.googleapis.com/auth/userinfo.profile",

];

const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const GOOGLE_ACCESS_TOKEN_URL = process.env.GOOGLE_ACCESS_TOKEN_URL;

const mongoDBURI = process.env.MONGO_DB_URI;

// const loginURL = 'http://localhost:3001/login'
const loginURL = 'https://modista-backend.vercel.app/login'


const allowedOrigins = [
  'http://localhost:3001',
  'https://modista-app.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no `origin` (like mobile apps or CURL calls)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      // If the origin is in the allowedOrigins array, allow it
      callback(null, true);
    } else {
      // Otherwise, block the request with an error message
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH']
}));


const chat = new ChatOpenAI({
  modelName: "gpt-4-vision-preview",
  maxTokens: 1024,
  openAIApiKey: "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",
});

//CHAT MODEL FOR RECOMMENDATION
const chatModel = new ChatOpenAI({
  modelName: "gpt-4-turbo-2024-04-09",
  openAIApiKey: "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",
});

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are an AI fashion expert trained to analyze and recommend clothing choices based on a user's closet and their specific needs or scenarios. You understand fashion trends, styles, materials, and appropriate attire for various settings and occasions. Your task is to suggest the best outfit options considering the user's available clothing and the context or event they describe."],
  ["user", "{input}"],
]);


const outputParser = new StringOutputParser();
const llmChain =  prompt.pipe(chatModel).pipe(outputParser);

app.use(express.json());

// Configure multer to use the `/tmp` directory
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = '/tmp/uploads';
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  })
});

// Replace 'PASTE_YOUR_PINATA_JWT' with your actual Pinata JWT
const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI0ZWU5OTc2My03MzVlLTQxNWMtODBiMC05OTQ2NDdkYzM3NjIiLCJlbWFpbCI6ImFnYXRlbmFzaG9uc0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJpZCI6IkZSQTEiLCJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MX0seyJpZCI6Ik5ZQzEiLCJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MX1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiOWMzMDRkMzMwYzBlNWEzOWYyYzgiLCJzY29wZWRLZXlTZWNyZXQiOiJhZDMyNDczNTRhOTJhYjk4YmRkNWI3NWIyMTBjZjIzNTkzOWRhZWNlZDFlYmIxZGY1NjlmNmNlYzI0N2ViMjAzIiwiaWF0IjoxNzEzMTI0OTgyfQ.59fU0KrLvMhdbE196_gMYvyoq9joHwmzhJ1rklNQ2A8";


 
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: false,
    trim: true,
    required: [true, "Please provide a  name"],
    minlength: 3,
    maxlength: 56,
  },
  email: {
    type: String,
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      "Please provide a valid email.",
    ],
    unique: true,
  },
  password: {
    type: String,
    minlength: 6,
    required: false,
  },
});

UserSchema.methods.generateToken = function () {
  const token = jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_LIFETIME,
  });
  return token;
};

const UserA = mongoose.model("UserA", UserSchema);
app.get("/auth", async (req, res) => {
    const state = "some_state";
    const scopes = GOOGLE_OAUTH_SCOPES.join(" ");
    const GOOGLE_OAUTH_CONSENT_SCREEN_URL = `${GOOGLE_OAUTH_URL}?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${GOOGLE_CALLBACK_URL}&access_type=offline&response_type=code&state=${state}&scope=${scopes}`;
    res.redirect(GOOGLE_OAUTH_CONSENT_SCREEN_URL);
  });



app.get("/google/callback", async (req, res) => {
  const { code } = req.query;

  // Prepare the data for access token request
  const data = {
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: "https://modista-backend.vercel.app/google/callback", // Ensure this matches your OAuth redirect URI
    grant_type: "authorization_code",
  };

  // Request to exchange code for the token
  const response = await fetch(GOOGLE_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const access_token_data = await response.json();
  const { id_token } = access_token_data;

  // Decode ID token to get user info
  const token_info_response = await fetch(`${process.env.GOOGLE_TOKEN_INFO_URL}?id_token=${id_token}`);
  const token_info_data = await token_info_response.json();

  const { email, name } = token_info_data;

  try {
    let user = await UserA.findOne({ email });

    if (!user) {
      // Create new user if not found
      user = new UserA({ email, name });
      await user.save();
    } else {
      // Update existing user details
      user.name = name; // Update other fields as necessary
      await user.save();
    }

    // Generate JWT token
    const token = user.generateToken();

    // Redirect to the frontend home page with user info and token
    const frontendRedirectURL = `https://modista-app.vercel.app/steppingstone?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}`;
    res.redirect(frontendRedirectURL);

  } catch (error) {
    console.error('Database operation failed:', error);
    res.status(500).send('Error processing request');
  }
});


// Retrieve a user's closet
app.get('/user-closet', async (req, res) => {
  const userEmail = req.query.email; // Assuming the email is sent as a query parameter
  if (!userEmail) {
    return res.status(400).send({ error: "User email is required" });
  }

  try {
    // Find the user by email and populate their closet with the clothing documents
    const userWithCloset = await User.findOne({ email: userEmail }).populate('closet');

    if (!userWithCloset) {
      return res.status(404).send({ error: "User not found" });
    }

    // Send back the user's closet
    res.send({ message: "User closet retrieved successfully", closet: userWithCloset.closet });
  } catch (error) {
    console.error("Error retrieving user closet:", error);
    res.status(500).send({ error: "Error retrieving user closet" });
  }
});


// Recommend what to wear based on the user's closet and their input description
// app.post('/recommend-clothing', async (req, res) => {
//   const { userEmail, description } = req.body;
//   if (!userEmail || !description) {
//     return res.status(400).send({ error: "Both userEmail and description are required" });
//   }
// console.log("step1")
//   try {
//     // Retrieve user and their closet (using lean() for optimized performance)
//     const userWithCloset = await User.findOne({ email: userEmail })
//       .populate({ path: 'closet', options: { limit: 10 } }) // Limit to 10 items
//       .lean();

//       console.log("step2")
    
//     if (!userWithCloset) {
//       return res.status(404).send({ error: "User not found" });
//     }
//     console.log("step3")

//     // Prepare a concise description of the closet
//     const closetDescription = userWithCloset.closet.map(item => 
//       `${item.style} ${item.color} ${item.material} ${item.occasions} ${item.uniqueFeatures} ${item.imageUrl}.`
//     ).join(" ");
//     console.log("step4")

//     // Adjust the prompt to focus on simplicity and brevity
//     const prompt = `A closet contains:\n${closetDescription}\nThe user plans to: "${description}". Suggest the most suitable attire in JSON format, including relevant image URLs.`;
//     console.log("step5")

//     // Invoke OpenAI model (adjust timeout settings if available)
//     // const response = await llmChain.invoke({ input: prompt });
//     // const response = await llmChain.invoke({ input: prompt, timeout: 5000 });
//     // console.log(`respone: ${response}`)


//         // Invoke OpenAI model (adjust timeout settings if available)
//         let response;
//         try {
//           response = await llmChain.invoke({ input: prompt });
//           console.log(`response: ${response}`);
//         } catch (llmError) {
//           console.error("Error invoking llmChain:", llmError);
//           throw new Error("Error invoking OpenAI");
//         }

//     console.log("step6")

//     // Send back the recommendation
//     res.send({ recommendation: response });
//   } catch (error) {
//     console.error("Error generating recommendation:", error);
//     res.status(500).send({ error: "Error generating recommendation" });
//   }
// });

// Improved Retry Function with Exponential Backoff
const retryInvoke = async (llmChain, prompt, retries = 3, baseDelay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await llmChain.invoke({ input: prompt });
    } catch (llmError) {
      console.error(`llmChain Error on attempt ${i + 1}:`, llmError.message);
      if (i < retries - 1) {
        // Exponential backoff delay
        const delay = baseDelay * 2 ** i;
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw llmError;
      }
    }
  }
};

// Improved /recommend-clothing Endpoint
app.post('/recommend-clothing', async (req, res) => {
  const { userEmail, description } = req.body;
  if (!userEmail || !description) {
    return res.status(400).send({ error: "Both userEmail and description are required" });
  }

  console.log("Initiating Recommendation Process");
  try {
    // Retrieve user and their closet (optimized with lean and limit)
    const userWithCloset = await User.findOne({ email: userEmail })
      .populate({ path: 'closet', options: { limit: 5 } }) // Limit to 5 items
      .lean();

    console.log("User Closet Retrieved");

    if (!userWithCloset) {
      return res.status(404).send({ error: "User not found" });
    }

    // Create a concise description of the closet
    const closetDescription = userWithCloset.closet.map(item =>
      `${item.style} ${item.color} ${item.material} ${item.occasions} ${item.uniqueFeatures} ${item.imageUrl}.`
    ).join(" ");
    console.log("Closet Description Prepared");

    // Adjust the prompt to focus on simplicity and brevity
    const prompt = `A closet contains:\n${closetDescription}\nThe user plans to: "${description}". Suggest the most suitable attire in JSON format and return the image url.`;
    console.log("Prompt Prepared");

    // Invoke OpenAI model with enhanced retry logic
    const response = await retryInvoke(llmChain, prompt);
    console.log(`Response Received: ${response}`);

    // Send back the recommendation
    res.send({ recommendation: response });
  } catch (error) {
    console.error("Error Generating Recommendation:", error.message);
    res.status(500).send({ error: "Error generating recommendation. Please try again." });
  }
});



app.post('/upload-and-analyze-clothing', upload.single('file'), async (req, res) => {
  const userEmail = req.body.userEmail; // Ensure userEmail is passed in the form-data
  if (!req.file || !userEmail) {
      return res.status(400).send({ error: "File and userEmail are required" });
  }

  try {
      // Upload to IPFS
      const formData = new FormData();
      const readStream = fs.createReadStream(req.file.path);
      formData.append("file", readStream);
      const pinataMetadata = JSON.stringify({ name: req.file.originalname });
      formData.append("pinataMetadata", pinataMetadata);
      const pinataOptions = JSON.stringify({ cidVersion: 1 });
      formData.append("pinataOptions", pinataOptions);
      const pinResponse = await axios.post(
          "https://api.pinata.cloud/pinning/pinFileToIPFS",
          formData,
          { headers: {
              ...formData.getHeaders(),
              Authorization: `Bearer ${JWT}`
          }}
      );
      fs.unlinkSync(req.file.path); // Clean up the uploaded file from local storage

      // Analyze the clothing using the AI model
      const imageUrl = `https://gateway.pinata.cloud/ipfs/${pinResponse.data.IpfsHash}`;
      const hostedImageMessage = new HumanMessage({
          content: [{
              type: "text",
              text: "You are an AI fashion designer with expertise in analyzing fashion items. Your role is to examine uploaded images of clothing and catalog them according to specific attributes. For each item, provide a detailed description in the following standardized format:\n\n- **Style:** Describe the general style of the clothing (e.g., casual, formal, sporty).\n- **Color:** Specify the primary and any notable secondary colors.\n- **Material:** Identify the material(s) the clothing is made from.\n- **Occasions:** Suggest suitable occasions for wearing the item (e.g., everyday wear, formal events, outdoor activities).\n- **Unique Features:** Note any unique features or patterns (e.g., embroidery, prints, cuts).\n- **Recommended Combinations:** Suggest other types of clothing or accessories that would pair well with this item.",
            }, {
              type: "image_url",
              image_url: imageUrl,
          }],
      });
      const response = await chat.invoke([hostedImageMessage]);
      const contentString = response.content;

      // Extract clothing attributes from AI response
      const extractInfo = (field, content) => {
          const regex = new RegExp(`- \\*\\*${field}:\\*\\* ([^\\n]+)`);
          const match = content.match(regex);
          return match ? match[1] : '';
      };

      // Store clothing information in MongoDB
      let user = await User.findOne({ email: userEmail });
      if (!user) {
          user = new User({ email: userEmail });
          await user.save();
      }
      const clothing = new Clothing({
          user: user._id,
          style: extractInfo("Style", contentString),
          color: extractInfo("Color", contentString),
          material: extractInfo("Material", contentString),
          occasions: extractInfo("Occasions", contentString),
          uniqueFeatures: extractInfo("Unique Features", contentString),
          recommendedCombinations: extractInfo("Recommended Combinations", contentString),
          imageUrl
      });
      await clothing.save();
      user.closet.push(clothing._id);
      await user.save();

      res.send({ message: "Clothing uploaded, analyzed, and saved successfully.", clothingDetails: clothing });
  } catch (error) {
      console.error("Failed processing request:", error);
      res.status(500).send("Error processing request.");
  }
});
 
// Retrieve a specific clothing item by ID
app.get('/clothing/:id', async (req, res) => {
  const { id } = req.params; // Extract the ID from the route parameter

  if (!id) {
    return res.status(400).send({ error: "Clothing ID is required" });
  }

  try {
    const clothingItem = await Clothing.findById(id); // Query the database for the clothing item
    // console.log(clothingItem)
    if (!clothingItem) {
      return res.status(404).send({ error: "Clothing item not found" });
    }
    res.send({ message: "Clothing item retrieved successfully", clothingItem });
  } catch (error) {
    console.error("Error retrieving clothing item:", error);
    res.status(500).send({ error: "Error retrieving clothing item" });
  }
});



// app.listen(port, () => {
//   console.log(`Fashion analysis API listening at http://localhost:${port}`);
// });

// Function to verify that the OpenAI chain is ready
async function validateOpenAIChain() {
  try {
    // Test prompt for chain validation
    const prompt = "Test input to verify OpenAI chain is working.";
    const response = await llmChain.invoke({ input: prompt });
    console.log(`OpenAI chain validation response: ${response}`);
    return true;
  } catch (error) {
    console.error("OpenAI chain validation failed:", error);
    return false;
  }
}

// Initialize the server
(async function initializeServer() {
  // Validate the llmChain before starting the server
  const chainReady = await validateOpenAIChain();
  if (!chainReady) {
    console.error("OpenAI chain initialization failed. Aborting server startup.");
    return;
  }

  // Start the server
  app.listen(port, () => {
    console.log(`Fashion analysis API listening at http://localhost:${port}`);
  });
})();
