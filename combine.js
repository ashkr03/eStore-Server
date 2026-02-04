import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const uri = process.env.MONGODB_URI || 'mongodb+srv://E-Store:12345@cluster0.ja1gmnk.mongodb.net/?appName=Cluster0';
const client = new MongoClient(uri);

let db;
let users;
let collection;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('LoginData');
    users = db.collection('users');
    console.log('MongoDB Connected! (LoginData)');
  } catch (err) {
    console.error('MongoDB Error', err);
    process.exit(1);
  }
}

async function connectDBStore() {
  try {
    const storeDb = client.db('Store-Item');  
    collection = storeDb.collection('StoreItems');
  } catch (error) {
  }
}

// Pehle LoginData connect karo, phir Store-Item
connectDB().then(() => {
  connectDBStore();
  
  // Auth routes define karo connect hone ke baad
  // Signup
  app.post('/api/signup', async (req, res) => {
    try {
      const { Name, Email, Password } = req.body;
      const existingUser = await users.findOne({ Email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      const hashedPassword = await bcrypt.hash(Password, 10);
      await users.insertOne({ Name, Email, Password: hashedPassword, createdAt: new Date() });
      res.json({ success: true, message: 'ID created successfull' });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Signin
  app.post('/api/signin', async (req, res) => {
    try {
      const { Email, Password } = req.body;
      const user = await users.findOne({ Email });
      if (!user || !await bcrypt.compare(Password, user.Password)) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      res.json({ success: true, message: `Welcome ${user.Name}!`, name: user.Name });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  });
});

// Store routes (inme collection check hai, safe hain)
app.get('/Store-Items', async (req, res) => {
  if (!collection) return res.json([]);
  const items = await collection.find({}).toArray();
  res.json(items);
});

app.post('/Store-Items', async (req, res) => {
  console.log('POST body', req.body, 'Debug');
  if (!collection) return res.status(503).json({ error: 'DB not ready' });
  try {
    const newItem = req.body;
    const result = await collection.insertOne(newItem);
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/Store-Items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('GET single ID', id);
    if (!id || !collection) return res.status(400).json({ error: 'Invalid ID' });
    const item = await collection.findOne({ _id: new ObjectId(id) });
    res.json(item || null);
  } catch (error) {
    console.error('GET /:id error', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/Store-Items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    console.log('UPDATE - ID', id);
    console.log('UPDATE - Data', updateData);
    if (!id || !collection) return res.status(400).json({ error: 'Invalid request' });

    let objId;
    try {
      objId = new ObjectId(id);
    } catch {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await collection.updateOne({ _id: objId }, { $set: updateData });
    console.log('UPDATE result', result);
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true, modified: result.modifiedCount > 0 });
  } catch (error) {
    console.error('PUT ERROR', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/Store-Items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    res.json({ success: result.deletedCount > 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 5300;
app.listen(PORT, () => {
  console.log(`🚀 Server http://localhost:${PORT}`);
  console.log(`📱 Auth: http://localhost:${PORT}/api/signin`);
  console.log(`🛒 Store: http://localhost:${PORT}/Store-Items`);
});
