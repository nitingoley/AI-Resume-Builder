const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4001;

// Initialize GoogleGenerativeAI with the API key
const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Load the gemini model
const geminiModel = googleAI.getGenerativeModel({
    model: "gemini-1.5-flash",
});

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads")); // Static folder for uploaded files
app.use(express.json());
app.use(cors());

// Helper function to generate unique IDs
const generateID = () => Math.random().toString(36).substring(2, 10);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // Limit file size to 5 MB
});

// Async function to generate content using Google Generative AI
const generateTextWithGoogleAI = async (question) => {
    try {
        const result = await geminiModel.generateContent(question);
        return result.response.text(); // Access the response text
    } catch (error) {
        console.error("Error generating content:", error);
        throw error; // Rethrow the error for further handling
    }
};

// Route to handle resume creation
app.post("/resume/create", upload.single("headshotImage"), async (req, res) => {
    const { fullName, currentPosition, currentLength, currentTechnologies, workHistory } = req.body;
    const workArray = JSON.parse(workHistory);

    const newEntry = {
        id: generateID(),
        fullName,
        image_url: `http://localhost:${PORT}/uploads/${req.file.filename}`,
        currentPosition,
        currentLength,
        currentTechnologies,
        workHistory: workArray,
    };

    // AI prompts for generating the resume sections
    const prompt1 = `I am writing a resume, my details are \n name: ${fullName} \n role: ${currentPosition} (${currentLength} years). \n I write in the technologies: ${currentTechnologies}. Can you write a 100 words description for the top of the resume (first-person writing)?`;

    const prompt2 = `I am writing a resume, my details are \n name: ${fullName} \n role: ${currentPosition} (${currentLength} years). \n I write in the technologies: ${currentTechnologies}. Can you write 10 points for a resume on what I am good at?`;

    const remainderText = () => {
        return workArray.map(item => ` ${item.name} as a ${item.position}.`).join('');
    };

    const prompt3 = `I am writing a resume, my details are \n name: ${fullName} \n role: ${currentPosition} (${currentLength} years). \n During my years I worked at ${workArray.length} companies. ${remainderText()} \n Can you write me 50 words for each company separated in numbers of my success in the company (in first-person)?`;

    try {
        // Call Google Generative AI for each section of the resume
        const objective = await generateTextWithGoogleAI(prompt1);
        const keypoints = await generateTextWithGoogleAI(prompt2);
        const jobResponsibilities = await generateTextWithGoogleAI(prompt3);

        // Combine the AI-generated content with the original data
        const generatedResumeData = { objective, keypoints, jobResponsibilities };
        const data = { ...newEntry, ...generatedResumeData };

        res.json({
            message: "Resume generated successfully!",
            data,
        });
    } catch (error) {
        res.status(500).json({ message: "An error occurred while generating the resume.", error });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
