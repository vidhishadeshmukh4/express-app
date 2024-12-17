const express = require('express');
const mysql = require('mysql2/promise'); 
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3008;

app.use(bodyParser.json());
app.use(cors());

// Create MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'vidhi@484',
  database: 'icecream'
});

// Middleware to check authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401); // No token

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
      if (err) return res.sendStatus(403); // Invalid token
      req.user = user;
      next();
  });
};


// Get all products (names only)
app.get('/api/products_emp', async (req, res) => {
  const query = 'SELECT product_id, product_name FROM product_master'; // Include ProductID for later use
  try {
    const [results] = await pool.query(query);
    res.json(results);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ message: 'Error fetching products' });
  }
});

// Get product details by ProductID
app.get('/api/products/:ProductID', async (req, res) => {
  const { ProductID } = req.params;
  console.log(`Received ProductID: ${ProductID}`); // Log the received ProductID
  try {
    const query = 'SELECT * FROM product_master WHERE product_id = ?';
    const [rows] = await pool.query(query, [ProductID]);
    console.log('Database query result:', rows); // Log the result from the database
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get distinct product types
app.get('/api/product-types', async (req, res) => {
  const query = 'SELECT DISTINCT product_type FROM product_master';
  try {
    const [results] = await pool.query(query);
    res.json(results);
  } catch (err) {
    console.error('Error fetching product types:', err);
    res.status(500).json({ message: 'Error fetching product types' });
  }
});

// Get flavours by category
app.get('/api/flavours', async (req, res) => {
  const { category } = req.query;
  let query = 'SELECT flavour, product_id FROM product_master';
  const params = [];

  if (category) {
    query += ' WHERE product_type = ?';
    params.push(category);
  }

  try {
    const [results] = await pool.query(query, params);
    res.json(results);
  } catch (err) {
    console.error('Error fetching flavours:', err);
    res.status(500).json({ message: 'Error fetching flavours' });
  }
});

// Get price based on flavour and category
// Get price based on flavour and category
app.get('/api/price', async (req, res) => {
  const { flavour, category } = req.query;
  try {
    const query = `
      SELECT pm.product_id, sd.Price
      FROM sales_details sd
      JOIN product_master pm ON sd.product_id = pm.product_id
      WHERE pm.flavour = ? AND pm.product_type = ?
    `;
    const [rows] = await pool.query(query, [flavour, category]);
    if (rows.length > 0) {
      res.json(rows[0]); // Return the response with product_id and Price
    } else {
      res.status(404).json({ message: 'Price not found' });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


app.post('/login', async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ success: false, message: 'Please provide all required fields' });
  }

  const query = 'SELECT * FROM registration WHERE username = ? AND password = ? AND user_role = ?';
  try {
    const [results] = await pool.query(query, [username, password, role]);
    if (results.length > 0) {
      console.log('Login successful');
      res.json({ success: true, role: results[0].user_role });
    } else {
      console.log('Invalid credentials');
      res.json({ success: false, message: 'Invalid credentials!' });
    }
  } catch (err) {
    console.error('Error during query execution:', err);
    res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
  }
});

app.get('/api/get-first-name', async (req, res) => {
  const { username } = req.query;
  try {
    const query = 'SELECT first_name FROM registration WHERE username = ?';
    const [results] = await pool.query(query, [username]);
    if (results.length > 0) {
      res.json({ first_name: results[0].first_name });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    console.error('Error fetching first name:', err);
    res.status(500).json({ message: 'Error fetching first name' });
  }
});
//http://localhost:3002/api/get-first-name?username=alice123

// Fetch user_id by username
app.get('/api/get-user-id', async (req, res) => {
  const { username } = req.query;
  try {
    const query = 'SELECT user_id FROM registration WHERE username = ?';
    const [results] = await pool.query(query, [username]);
    if (results.length > 0) {
      res.json({ user_id: results[0].user_id });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    console.error('Error fetching user_id:', err);
    res.status(500).json({ message: 'Error fetching user_id' });
  }
});


//for updating items in databse whever bill is genarted
app.get('/api/check-quantity/:ProductID', async (req, res) => {
  const { ProductID } = req.params;

  try {
    const [rows] = await pool.query('SELECT quantity FROM stocks WHERE product_id = ?', [ProductID]);
    if (rows.length > 0) {
      res.json({ quantity: rows[0].quantity });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (err) {
    console.error('Error checking quantity:', err);
    res.status(500).json({ message: 'Error checking quantity' });
  }
});

app.post('/api/update-quantity', async (req, res) => {
  const { ProductID, quantitySold } = req.body;
  console.log('Received in update-quantity:', { ProductID, quantitySold });

  if (!ProductID || !quantitySold) {
    return res.status(400).json({ message: 'ProductID and quantitySold are required' });
  }

  try {
    const [productRows] = await pool.query('SELECT quantity FROM stocks WHERE product_id = ?', [ProductID]);
    if (productRows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const currentQuantity = productRows[0].quantity;
    const newQuantity = currentQuantity - quantitySold;

    if (newQuantity < 0) {
      return res.status(400).json({ message: 'Not enough stock' });
    }

    await pool.query('UPDATE stocks SET quantity = ? WHERE product_id = ?', [newQuantity, ProductID]);

    res.json({ message: 'Quantity updated successfully', newQuantity });
  } catch (err) {
    console.error('Error updating quantity:', err);
    res.status(500).json({ message: 'Error updating quantity' });
  }
});


app.post('/api/add-customer', async (req, res) => {
  const { name, contact, address, date } = req.body;

  if (!name || !contact || !address || !date) {
    return res.status(400).json({ message: 'Name, contact, address, and date are required' });
  }

  try {
    // Check if the mobile number already exists
    const [existingCustomer] = await pool.query('SELECT * FROM customers WHERE contact_no = ?', [contact]);

    if (existingCustomer.length > 0) {
      // Return existing customer_id
      return res.status(200).json({ 
        message: 'Customer already exists',
        customer_id: existingCustomer[0].customer_id 
      });
    }

    // Insert new customer
    const [result] = await pool.query('INSERT INTO customers (customer_name, contact_no, address, active_status, date) VALUES (?, ?, ?, ?, ?)', [name, contact, address, 1, date]);

    // Return customer_id of newly inserted customer
    res.status(201).json({ 
      message: 'Customer added successfully',
      customer_id: result.insertId 
    });

  } catch (error) {
    console.error('Error adding customer:', error);
    res.status(500).json({ message: 'Error adding customer', error: error.message });
  }
});



// In your backend (Express server)
app.post('/api/add-sale', async (req, res) => {
  const { customer_id, user_id, total_cost } = req.body;

  // Log the incoming request body for debugging
  console.log('Received sale data:', req.body);

  if (customer_id == null || user_id == null || total_cost == null) {
    return res.status(400).json({ 
      message: 'customer_id, user_id, and total_cost are required',
      received: {
        customer_id,
        user_id,
        total_cost
      }
    });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO sales (customer_id, user_id, total_cost) VALUES (?, ?, ?)',
      [customer_id, user_id, total_cost]
    );
    res.status(201).json({ sales_id: result.insertId });
  } catch (error) {
    console.error('Error adding sale:', error);
    res.status(500).json({ message: 'Error adding sale', error: error.message });
  }
});



// Add this route to your backend
app.get('/api/bills', async (req, res) => {
  try {
    const query = `
      SELECT s.customer_id, c.customer_name, c.contact_no AS mob_no, c.date, s.total_cost AS billing_amount, r.username AS employee_name
      FROM sales s
      JOIN customers c ON s.customer_id = c.customer_id
      JOIN registration r ON s.customer_id = r.user_id;
    `;
    const [rows] = await pool.query(query);
    res.json(rows); // Ensure response is in JSON format
  } catch (error) {
    console.error('Error fetching bills data:', error);
    res.status(500).json({ message: 'Error fetching bills data' });
  }
});


// Employee API routes (new code)

app.get('/api/employees', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM employees');
    res.json(results);
  } catch (err) {
    console.error('Error fetching employees:', err);
    res.status(500).json({ message: 'Error fetching employees' });
  }
});

app.get('/api/employees/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const [results] = await pool.query('SELECT * FROM employees WHERE user_id = ?', [user_id]);
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Employee not found' });
    }
  } catch (err) {
    console.error('Error fetching employee:', err);
    res.status(500).json({ message: 'Error fetching employee' });
  }
});

app.post('/api/employees', async (req, res) => {
  const { employee_name, contact_no, position } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO employees (employee_name, contact_no, position) VALUES (?, ?, ?)', [employee_name, contact_no, position]);
    res.json({
      user_id: result.insertId,
      employee_name,
      contact_no,
      position
    });
  } catch (err) {
    console.error('Error adding employee:', err);
    res.status(500).json({ message: 'Error adding employee' });
  }
});

app.put('/api/employees/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const { employee_name, contact_no, position } = req.body;
  try {
    const [result] = await pool.query('UPDATE employees SET employee_name = ?, contact_no = ?, position = ? WHERE user_id = ?', [employee_name, contact_no, position, user_id]);
    res.json({ user_id, employee_name, contact_no, position });
  } catch (err) {
    console.error('Error updating employee:', err);
    res.status(500).json({ message: 'Error updating employee' });
  }
});

app.delete('/api/employees/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    await pool.query('DELETE FROM employees WHERE user_id = ?', [user_id]);
    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    console.error('Error deleting employee:', err);
    res.status(500).json({ message: 'Error deleting employee' });
  }
});


app.get('/api/users', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM registration');
    res.json(results);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

app.get('/api/users/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const [results] = await pool.query('SELECT * FROM registration WHERE user_id = ?', [user_id]);
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ message: 'Error fetching user' });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, password, email, first_name, last_name, user_role } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO registration (username, password, email, first_name, last_name, user_role) VALUES (?, ?, ?, ?, ?, ?)', 
    [username, password, email, first_name, last_name, user_role]);
    res.json({
      user_id: result.insertId,
      username,
      password,
      email,
      first_name,
      last_name,
      user_role,
      created_at: new Date(),
      updated_at: new Date()
    });
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).json({ message: 'Error adding user' });
  }
});

app.put('/api/users/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const { username, password, email, first_name, last_name, user_role } = req.body;
  try {
    const [result] = await pool.query('UPDATE registration SET username = ?, password = ?, email = ?, first_name = ?, last_name = ?, user_role = ?, updated_at = ? WHERE user_id = ?', 
    [username, password, email, first_name, last_name, user_role, new Date(), user_id]);
    res.json({ user_id, username, password, email, first_name, last_name, user_role, created_at: new Date(), updated_at: new Date() });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ message: 'Error updating user' });
  }
});

app.delete('/api/users/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    await pool.query('DELETE FROM registration WHERE user_id = ?', [user_id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Sales API routes

app.get('/api/sales', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM sales');
    res.json(results);
  } catch (err) {
    console.error('Error fetching sales:', err);
    res.status(500).json({ message: 'Error fetching sales' });
  }
});

app.get('/api/sales/:sales_id', async (req, res) => {
  const { sales_id } = req.params;
  try {
    const [results] = await pool.query('SELECT * FROM sales WHERE sales_id = ?', [sales_id]);
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Sale not found' });
    }
  } catch (err) {
    console.error('Error fetching sale:', err);
    res.status(500).json({ message: 'Error fetching sale' });
  }
});

app.post('/api/sales', async (req, res) => {
  const { customer_id, employee_id, total_amount, date } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO sales (customer_id, employee_id, total_amount, date) VALUES (?, ?, ?, ?)', 
    [customer_id, employee_id, total_amount, date]);
    res.json({
      sales_id: result.insertId,
      customer_id,
      employee_id,
      total_amount,
      date
    });
  } catch (err) {
    console.error('Error adding sale:', err);
    res.status(500).json({ message: 'Error adding sale' });
  }
});

app.put('/api/sales/:sales_id', async (req, res) => {
  const { sales_id } = req.params;
  const { customer_id, employee_id, total_amount, date } = req.body;
  try {
    const [result] = await pool.query('UPDATE sales SET customer_id = ?, employee_id = ?, total_amount = ?, date = ? WHERE sales_id = ?', 
    [customer_id, employee_id, total_amount, date, sales_id]);
    res.json({ sales_id, customer_id, employee_id, total_amount, date });
  } catch (err) {
    console.error('Error updating sale:', err);
    res.status(500).json({ message: 'Error updating sale' });
  }
});

app.delete('/api/sales/:sales_id', async (req, res) => {
  const { sales_id } = req.params;
  try {
    await pool.query('DELETE FROM sales WHERE sales_id = ?', [sales_id]);
    res.json({ message: 'Sale deleted successfully' });
  } catch (err) {
    console.error('Error deleting sale:', err);
    res.status(500).json({ message: 'Error deleting sale' });
  }
});

// Get all customers
app.get('/api/customers', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM customers');
    res.json(results);
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ message: 'Error fetching customers' });
  }
});

// Get a specific customer by customer_id
app.get('/api/customers/:customer_id', async (req, res) => {
  const { customer_id } = req.params;
  try {
    const [results] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [customer_id]);
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
  } catch (err) {
    console.error('Error fetching customer:', err);
    res.status(500).json({ message: 'Error fetching customer' });
  }
});

// Create a new customer
app.post('/api/customers', async (req, res) => {
  const { customer_name, contact_no, active_status, date } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO customers (customer_name, contact_no, active_status, date) VALUES (?, ?, ?, ?)', 
    [customer_name, contact_no, active_status, date]);
    res.json({
      customer_id: result.insertId,
      customer_name,
      contact_no,
      active_status,
      date
    });
  } catch (err) {
    console.error('Error adding customer:', err);
    res.status(500).json({ message: 'Error adding customer' });
  }
});

// Update an existing customer by customer_id
app.put('/api/customers/:customer_id', async (req, res) => {
  const { customer_id } = req.params;
  const { customer_name, contact_no, active_status, date } = req.body;
  try {
    const [result] = await pool.query('UPDATE customers SET customer_name = ?, contact_no = ?, active_status = ?, date = ? WHERE customer_id = ?', 
    [customer_name, contact_no, active_status, date, customer_id]);
    res.json({ customer_id, customer_name, contact_no, active_status, date });
  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(500).json({ message: 'Error updating customer' });
  }
});

// Delete a customer by customer_id
app.delete('/api/customers/:customer_id', async (req, res) => {
  const { customer_id } = req.params;
  try {
    await pool.query('DELETE FROM customers WHERE customer_id = ?', [customer_id]);
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ message: 'Error deleting customer' });
  }
});

// Get all products


// Get all products
app.get('/products', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM product_master');
    res.json(results);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add a new product
app.post('/add_product', async (req, res) => {
  const { product_name, package_type, flavour, product_type } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO product_master (product_name, package_type, flavour, product_type) VALUES (?, ?, ?, ?)', 
    [product_name, package_type, flavour, product_type]);
    res.status(201).json({ message: 'Product added successfully', product_id: result.insertId });
  } catch (err) {
    console.error('Error adding product:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update a product
app.put('/products/:id', async (req, res) => {
  const { id } = req.params;
  const { product_name, package_type, flavour, product_type } = req.body;
  try {
    const [result] = await pool.query('UPDATE product_master SET product_name = ?, package_type = ?, flavour = ?, product_type = ? WHERE product_id = ?', 
    [product_name, package_type, flavour, product_type, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json({ message: 'Product updated successfully' });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Error updating product. Please try again.' });
  }
});

// Delete a product
app.delete('/products/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // First, delete rows from sales_details that reference the product
    await pool.query('DELETE FROM sales_details WHERE product_id = ?', [id]);
    
    // Then, delete the product from product_master
    const [result] = await pool.query('DELETE FROM product_master WHERE product_id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Error deleting product. Please try again.' });
  }
});



// Get all stocks
app.get('/api/stocks', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM stocks');
    res.json(results);
  } catch (err) {
    console.error('Error fetching stocks:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get stocks by product_id
app.get('/api/stocks/:product_id', async (req, res) => {
  const { product_id } = req.params;
  try {
    const [results] = await pool.query('SELECT * FROM stocks WHERE product_id = ?', [product_id]);
    res.json(results[0]);
  } catch (err) {
    console.error('Error fetching stock:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new stock
app.post('/api/stocks', async (req, res) => {
  const { product_id, quantity_in_stock } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO stocks (product_id, quantity_in_stock) VALUES (?, ?)', [product_id, quantity_in_stock]);
    res.json({ product_id, quantity_in_stock });
  } catch (err) {
    console.error('Error adding stock:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update stock by product_id
app.put('/api/stocks/:product_id', async (req, res) => {
  const { product_id } = req.params;
  const { quantity_in_stock } = req.body;
  try {
    const [result] = await pool.query('UPDATE stocks SET quantity_in_stock = ? WHERE product_id = ?', [quantity_in_stock, product_id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Stock not found.' });
    }
    res.json({ product_id, quantity_in_stock });
  } catch (err) {
    console.error('Error updating stock:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete stock by product_id
app.delete('/api/stocks/:product_id', async (req, res) => {
  const { product_id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM stocks WHERE product_id = ?', [product_id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Stock not found.' });
    }
    res.json({ message: 'Stock deleted successfully' });
  } catch (err) {
    console.error('Error deleting stock:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get Sales Details with Product and Customer Information
app.get('/api/sales/:sales_id/details', async (req, res) => {
  const { sales_id } = req.params;
  try {
    const [results] = await pool.query(
      `SELECT s.*, sd.quantity, sd.price, p.product_name, c.customer_name 
       FROM sales s 
       JOIN sales_details sd ON s.sales_id = sd.sales_id 
       JOIN product_master p ON sd.product_id = p.product_id 
       JOIN customers c ON s.customer_id = c.customer_id 
       WHERE s.sales_id = ?`,
      [sales_id]
    );
    res.json(results);
  } catch (err) {
    console.error('Error fetching sales details:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get products expiring within the next 30 days
app.get('/api/expiring_products', async (req, res) => {
  try {
    const [results] = await pool.query(
      `SELECT pm.product_name, s.quantity, s.expiry_date
       FROM stocks s
       JOIN product_master pm ON s.product_id = pm.product_id
       WHERE s.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)`
    );
    res.json(results);
  } catch (err) {
    console.error('Error fetching expiring products:', err);
    res.status(500).json({ error: err.message });
  }
});

// Route to display expiring products in a table format
app.get('/expiring-products/table', async (req, res) => {
  try {
    const [results] = await pool.query(
      `SELECT pm.product_name, s.quantity, s.expiry_date
       FROM stocks s
       JOIN product_master pm ON s.product_id = pm.product_id
       WHERE s.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)`
    );
    res.render('expiring-products-table', { expiringProducts: results });
  } catch (err) {
    console.error('Error fetching expiring products for table:', err);
    res.status(500).json({ error: err.message });
  }
});

// Check for low stock levels
app.get('/api/low-stock', async (req, res) => {
  try {
    const [results] = await pool.query(
      `SELECT * FROM stocks
       WHERE quantity < 30`
    );
    res.json(results);
  } catch (err) {
    console.error('Error fetching low stock levels:', err);
    res.status(500).json({ error: err.message });
  }
});

// Example: Low Stock Products Endpoint
app.get('/api/products/low-stock', async (req, res) => {
  try {
    // Fetch products with low stock levels from the database
    const [results] = await pool.query(
      `SELECT * FROM stocks
       WHERE quantity < 10`
    );
    res.json(results);
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).send('Server Error');
  }
});

// Route to render the low stock products
app.get('/low_stock', async (req, res) => {
  try {
    const [results] = await pool.query(
      `SELECT * FROM stocks
       WHERE quantity < 10`
    );
    res.render('lowStockTable', { products: results });
  } catch (err) {
    console.error('Error fetching low stock products for table:', err);
    res.status(500).json({ error: err.message });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});