
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

// import express from "express"
// import { ChatOpenAI } from "@langchain/openai";
// import { HumanMessage } from "@langchain/core/messages";

// const app = express();
// const port = 3000;

// const chat = new ChatOpenAI({
//   modelName: "gpt-4-vision-preview",
//   maxTokens: 1024,
//   openAIApiKey: "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",
// });



// app.use(express.json());

// app.post('/analyze-clothing', async (req, res) => {
//   const imageUrl = req.body.imageUrl;
//   if (!imageUrl) {
//     return res.status(400).send({ error: "imageUrl is required" });
//   }

//   const hostedImageMessage = new HumanMessage({
//     content: [
//       {
//         type: "text",
//         text: "You are an AI fashion designer with expertise in analyzing fashion items. Your role is to examine uploaded images of clothing and catalog them according to specific attributes. For each item, provide a detailed description in the following standardized format:\n\n- **Style:** Describe the general style of the clothing (e.g., casual, formal, sporty).\n- **Color:** Specify the primary and any notable secondary colors.\n- **Material:** Identify the material(s) the clothing is made from.\n- **Occasions:** Suggest suitable occasions for wearing the item (e.g., everyday wear, formal events, outdoor activities).\n- **Unique Features:** Note any unique features or patterns (e.g., embroidery, prints, cuts).\n- **Recommended Combinations:** Suggest other types of clothing or accessories that would pair well with this item.",
//       },
//       {
//         type: "image_url",
//         image_url: imageUrl, // Use the imageUrl from the request
//       },
//     ],
//   });


//   try {
//     const response = await chat.invoke([hostedImageMessage]);
//     res.send(response);
//   } catch (error) {
//     console.error("Error processing image analysis:", error);
//     res.status(500).send({ error: "Error processing image analysis" });
//   }
// });



// app.listen(port, () => {
//   console.log(`Fashion analysis API listening at http://localhost:${port}`);
// });


import express from "express";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import mongoose from "mongoose";

// MongoDB connection URI and schema definition
const mongoURI = "mongodb+srv://agatenashons:yt4WXrBcQuel4ovj@cluster0.yz8zuwc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // Replace with your actual MongoDB URI

// Connect to MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Define a schema for the clothing analysis
const clothingSchema = new mongoose.Schema({
  style: String,
  color: String,
  material: String,
  occasions: String,
  uniqueFeatures: String,
  recommendedCombinations: String,
  imageUrl: String, // Optionally store the image URL for reference
}, { timestamps: true });

// Create a model from the schema
const Clothing = mongoose.model('Clothing', clothingSchema);

const app = express();
const port = 3000;

const chat = new ChatOpenAI({
  modelName: "gpt-4-vision-preview",
  maxTokens: 1024,
  openAIApiKey: "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", // Make sure to replace with your actual API key
});

app.use(express.json());

app.post('/analyze-clothing', async (req, res) => {
  const imageUrl = req.body.imageUrl;
  if (!imageUrl) {
    return res.status(400).send({ error: "imageUrl is required" });
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
    console.log(response);
    // Accessing 'content' directly from the 'response' object
    const contentString = response.content; // Corrected access to 'content'
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
  
    // Then create a new clothing document and save to MongoDB as previously outlined
    const clothing = new Clothing({
      style,
      color,
      material,
      occasions,
      uniqueFeatures,
      recommendedCombinations,
      imageUrl // Assuming you still want to save the image URL
    });
  
    await clothing.save();
  
    // Optionally, modify what you send back to the client
    res.send({ message: "Analysis saved successfully", data: clothing });
  } catch (error) {
    console.error("Error processing image analysis:", error);
    res.status(500).send({ error: "Error processing image analysis" });
  }
  
  
});

app.listen(port, () => {
  console.log(`Fashion analysis API listening at http://localhost:${port}`);
});
