
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
const streamPipeline = promisify(pipeline);

const mongoURI = "mongodb+srv://agatenashons:yt4WXrBcQuel4ovj@cluster0.yz8zuwc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // Replace with your actual MongoDB URI
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

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
const llmChain = prompt.pipe(chatModel).pipe(outputParser);

app.use(express.json());


// Multer setup for handling file uploads
const upload = multer({ dest: 'uploads/' });

// Replace 'PASTE_YOUR_PINATA_JWT' with your actual Pinata JWT
const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI0ZWU5OTc2My03MzVlLTQxNWMtODBiMC05OTQ2NDdkYzM3NjIiLCJlbWFpbCI6ImFnYXRlbmFzaG9uc0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJpZCI6IkZSQTEiLCJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MX0seyJpZCI6Ik5ZQzEiLCJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MX1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiOWMzMDRkMzMwYzBlNWEzOWYyYzgiLCJzY29wZWRLZXlTZWNyZXQiOiJhZDMyNDczNTRhOTJhYjk4YmRkNWI3NWIyMTBjZjIzNTkzOWRhZWNlZDFlYmIxZGY1NjlmNmNlYzI0N2ViMjAzIiwiaWF0IjoxNzEzMTI0OTgyfQ.59fU0KrLvMhdbE196_gMYvyoq9joHwmzhJ1rklNQ2A8";

app.post('/analyze-clothing', async (req, res) => {
  const { imageUrl, userEmail } = req.body;
  if (!imageUrl || !userEmail) {
    return res.status(400).send({ error: "imageUrl and userEmail are required" });
  }


    const hostedImageMessage = new HumanMessage({
    content: [
      {
        type: "text",
  text: "You are an AI fashion designer with expertise in analyzing fashion items. Your role is to examine uploaded images of clothing and catalog them according to specific attributes. For each item, provide a detailed description in the following standardized format:\n\n- **Style:** Describe the general style of the clothing (e.g., casual, formal, sporty).\n- **Color:** Specify the primary and any notable secondary colors.\n- **Material:** Identify the material(s) the clothing is made from.\n- **Occasions:** Suggest suitable occasions for wearing the item (e.g., everyday wear, formal events, outdoor activities).\n- **Unique Features:** Note any unique features or patterns (e.g., embroidery, prints, cuts).\n- **Recommended Combinations:** Suggest other types of clothing or accessories that would pair well with this item.",
},
      {
        type: "image_url",
        image_url: imageUrl,
      },
    ],
  });

  try {
    const response = await chat.invoke([hostedImageMessage]);
    const contentString = response.content;

    // extraction logic
        console.log(contentString);
  
    // Proceed with extracting the information from 'contentString' as before
    const extractInfo = (field, content) => {
      const regex = new RegExp(`- \\*\\*${field}:\\*\\* ([^\\n]+)`);
      const match = content.match(regex);
      return match ? match[1] : '';
    };
  
    const style = extractInfo("Style", contentString);
    const color = extractInfo("Color", contentString);
    const material = extractInfo("Material", contentString);
    const occasions = extractInfo("Occasions", contentString);
    const uniqueFeatures = extractInfo("Unique Features", contentString);
    const recommendedCombinations = extractInfo("Recommended Combinations", contentString);
  
    
    let user = await User.findOne({ email: userEmail });
    if (!user) {
      user = new User({ email: userEmail });
      await user.save();
    }

    const clothing = new Clothing({
      user: user._id, // Linking clothing to the user
      // Other clothing fields
      style,
      color,
      material,
      occasions,
      uniqueFeatures,
      recommendedCombinations,
      imageUrl // Assuming you still want to save the image URL
    });
    await clothing.save();
    
    // Adding clothing to user's closet
    user.closet.push(clothing._id);
    await user.save();

    res.send({ message: "Analysis saved successfully", data: clothing });
  } catch (error) {
    console.error("Error processing image analysis:", error);
    res.status(500).send({ error: "Error processing image analysis" });
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
app.post('/recommend-clothing', async (req, res) => {
  const { userEmail, description } = req.body;
  if (!userEmail || !description) {
      return res.status(400).send({ error: "Both userEmail and description are required" });
  }

  try {
      // Retrieve user and their closet
      const userWithCloset = await User.findOne({ email: userEmail }).populate('closet');
      if (!userWithCloset) {
          return res.status(404).send({ error: "User not found" });
      }

      // Prepare the input for the AI based on the user's closet and the description provided
      let closetDescription = userWithCloset.closet.map(item => {
          return `${item.style} ${item.color} ${item.material} ${item.occasions} ${item.uniqueFeatures}.`;
      }).join(" ");

      // const prompt = `Given a closet containing: ${closetDescription}\nUser description: ${description}\nRecommend what to wear:`;
      const prompt = `Given a closet containing the following items:\n${closetDescription}\nBased on the user's description of their plans: "${description}", please recommend the most appropriate attire. List the recommended clothing items with brief descriptions and include their image URLs from the users closet of the specific cloths you recommend. Keep the response concise for display in a user interface.`;


      const response = await llmChain.invoke({
        input: prompt,
      });

      // Send back the recommendation
      res.send({ recommendation: response});
  } catch (error) {
      console.error("Error generating recommendation:", error);
      res.status(500).send({ error: "Error generating recommendation" });
  }
});


// POST endpoint for uploading clothing images
app.post('/upload-clothing-image', upload.single('file'), async (req, res) => {
  if (!req.file) {
      return res.status(400).send("No file uploaded.");
  }

  try {
      const formData = new FormData();
      const readStream = fs.createReadStream(req.file.path);
      formData.append("file", readStream);

      const pinataMetadata = JSON.stringify({
          name: req.file.originalname
      });
      formData.append("pinataMetadata", pinataMetadata);

      const pinataOptions = JSON.stringify({
          cidVersion: 1
      });
      formData.append("pinataOptions", pinataOptions);

      const response = await axios.post(
          "https://api.pinata.cloud/pinning/pinFileToIPFS",
          formData,
          { headers: {
              ...formData.getHeaders(),
              Authorization: `Bearer ${JWT}`
          }}
      );

      // Clean up the uploaded file from local storage
      fs.unlinkSync(req.file.path);

      res.send({
          message: "File uploaded successfully to IPFS.",
          ipfsUrl: `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`
      });
  } catch (error) {
      console.error("Failed to upload image to IPFS:", error);
      res.status(500).send("Failed to upload image to IPFS.");
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


app.listen(port, () => {
  console.log(`Fashion analysis API listening at http://localhost:${port}`);
});
