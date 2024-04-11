
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

app.use(express.json());

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


app.listen(port, () => {
  console.log(`Fashion analysis API listening at http://localhost:${port}`);
});
