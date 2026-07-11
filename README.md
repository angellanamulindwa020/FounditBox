


## Project Title
A Community-Based Personal Property Recovery System


## Problem

The pervasive loss of valuable documents and low-monetary value personal items within open communities, such as the Central Region of Kampala, presents persistent challenges. Current recovery methods are predominantly manual, informal and lack the verifiable structure necessary to foster trust and ensure successful recovery.

In open communities like universities, campuses, and public spaces, lost and found management is handled informally through word of mouth, WhatsApp groups, physical notice boards, or handing items to security. These methods have no central record, items get forgotten, there is no way for the person who lost something to know if it was found, and there is no accountability for who handled what.


## Solution

Foundit Box provides a structured digital platform where users can report lost or found items, and the community can help reunite people with their belongings. When an item is reported, the system automatically detects potential matches with other reports and notifies both parties. Users can claim found items, and once approved by the item owner, they can message each other directly to arrange the return. An admin oversees the platform  verifying users, approving item listings, and managing claims ensuring only legitimate reports are visible. This replaces informal, scattered methods with a transparent, accountable, and searchable system accessible from any device.



## SetUp Instructions 

### Prerequisites
- Node.js (v18 or higher)
- Git
- A MongoDB Atlas account

### Step 1 Clone the Repository
```bash
git clone https://github.com/angellanamulindwa020/foundit.git
cd foundit
```

### Step 2  Install Dependencies
```bash
cd server
npm install
```

### Step 3  Configure Environment Variables
Create a `.env` file inside the `server` folder with:
```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
PORT=5000
```

### Step 4  Start the Server
```bash
node server.js
```

You should see:
```
MongoDB connected
Server running on port 5000
```

### Step 5 Open the App
Go to `http://localhost:5000` in your browser.



## Admin Setup
To give a user admin access, run from the `server` folder:
```bash
node makeAdmin.js your@email.com


