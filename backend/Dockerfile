# Use a lightweight Node.js base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json (if it exists)
# This step is critical for installing dependencies
COPY package*.json ./

# Install project dependencies
# This command runs `npm install` inside the container,
# which solves the build failure you experienced.
RUN npm install

# Copy the rest of the application source code
COPY . .

# Expose the port your Express app runs on
EXPOSE 3001

# Define the command to run your application
CMD ["node", "server.js"]

