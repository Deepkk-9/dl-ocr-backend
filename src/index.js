const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const Groq = require('groq-sdk');
require('dotenv').config();


const app = express();
const port = 5000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors());

// Set up multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// System prompt for driving license information extraction
const systemPrompt = "You are a Indian driving license recognition expert. Extract all important information such as:\n1. Name\n2. Date of birth\n3. License number\n4. Address\n5. Expiry date\n6. Date of issue\n7.Son \ Daughter \ Wife of \n\n.The extracted information should be in a structured json format and remove all the unnecessary response text should contain only the info i need.";

// Function to interact with the Groq API and get a response from the model
const getGroqResponse = async (content) => {
    try {
        // Send request to Groq API
        const chatCompletion = await groq.chat.completions.create({
            "messages": [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": content }
            ],
            "model": "llama3-70b-8192",
            "temperature": 1,
            "max_tokens": 1024,
            "top_p": 1,
            "stream": false,
            "response_format": { "type": "json_object" },
            "stop": null
        });

        const response = chatCompletion.choices[0]?.message?.content || '';

        try {
            return JSON.parse(response);
        } catch (error) {
            console.error('Error parsing JSON:', error);
            return response;
        }

    } catch (error) {
        console.error('Error interacting with Groq API:', error);
        throw new Error('Error interacting with Groq API');
    }
};


// Endpoint for OCR processing and interacting with Groq API
app.post('/process-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // console.log('File mimetype:', req.file.mimetype);
        // console.log('Image buffer length:', req.file.buffer.length);

        const fileType = req.file.mimetype;
        if (!fileType.startsWith('image/')) {
            return res.status(400).json({ error: 'Uploaded file is not an image' });
        }

        // OCR processing with Tesseract.js
        const { data: { text } } = await Tesseract.recognize(req.file.buffer, 'eng');
        const cleanedText = text.replace(/\s+/g, ' '); // Basic cleanup of OCR text

        const groqResponse = await getGroqResponse(cleanedText);

        // console.log("Structured response : ", groqResponse);
        res.json({
            extractedText: cleanedText,
            structuredResponse: groqResponse,
        });
    } catch (error) {
        console.error('Error in processing:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
