const express = require('express');
const {open} = require('sqlite');
const sqlite3 = require('sqlite3').verbose()
const path = require('path');
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken')
const cors = require("cors");


const app = express();

app.use(express.json());
app.use(cors())

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Content-Type-Options, Accept, X-Requested-With, Origin, Access-Control-Request-Method, Access-Control-Request-Headers"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Private-Network", true);
  //  Firefox caps this at 24 hours (86400 seconds). Chromium (starting in v76) caps at 2 hours (7200 seconds). The default value is 5 seconds.
  res.setHeader("Access-Control-Max-Age", 7200)
  next();
});



const dbPath = path.join(__dirname, './userData.db');
let db = null;




const intializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3005, () => {
      console.log("Server Running at http://localhost:3005/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

intializeDbAndServer()

// chech Authentication Middleware function 
const checkAuthentication = (req, res, next) => {
  let jwtToken;
  const authHeader = req.headers["authorization"]
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1];
  }
  if (jwtToken === undefined) {
    res.status(401)
    res.send('Invalid User')
  } else {
    jwt.verify(jwtToken, "SECRET_TOKEN", async (error, payload) => {
      if (error) {
        res.status(401)
        res.send('Invalid User')
      } else {
        req.username = payload.username;
        next()
      }
    })
  }
}


// Get all services in Service table
app.get('/', (req, res) => {
  res.send("Hello Agastin!")
})

app.get('/services', async (req, res) => {
  const query = `SELECT * FROM Services;`
  const servicesArray = await db.all(query)
  
  res.send(servicesArray);
});

// post services in Services table 
app.post('/services', async (req, res) => {
  const {id, service, image, description} = req.body
  let IdExistQuery = `SELECT * FROM Services WHERE id=${id};`
  const idExist = await db.get(IdExistQuery);
  const createServiceQuery = `INSERT INTO Services(id, service, image, description)
                              VALUES (${id}, "${service}", "${image}", "${description}");`
  
  if (idExist === undefined) {
       await db.run(createServiceQuery);
    
       res.send({successMsg: 'Service Sucessfully Added'});
  } else {
    res.status(400);
    res.send({err_msg: 'Id is already exist'});
  }
  
})

// Send message api store the values in Messages table
// const sequence = /^\d{10}$/;
// number.toString().match(sequence);
app.post('/send-message', async (request, response) => {
  const {name, number, message} = request.body
  const createSendMessageQuery = `INSERT INTO Messages(name, number, message) VALUES("${name}", "${number}", "${message}");`
  const sequence = /^\d{10}$/;
  if (number.match(sequence)) {
    await db.run(createSendMessageQuery);
  
    response.send({successMsg: 'Send message successfully'});
  } else {
      response.status(400)
      response.send({err_msg: 'Please Check Your Number'});
  }
})

// Get the Messages from Messages table
app.get('/messages', async (request, response) => {
    const getMessagesQuery = `SELECT * FROM Messages;`
    const messagesArray = await db.all(getMessagesQuery)
    response.send(messagesArray)
})


// DELETE MESSAGE 
app.delete("/messages", checkAuthentication, async (request, response) => {
  const {id} = request.body 
  const deleteQuery = `DELETE FROM Messages WHERE id=${id};`
  await db.run(deleteQuery)
 
  response.send({successMsg: "Message delete successfully"});
})


// Register user
app.post("/register", async (request, response) => {
  const { username, password, email, gender } = request.body;
  // Hashed Password set
  const hashPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
            INSERT INTO user (username, password, email, gender)
            VALUES ("${username}", "${hashPassword}", "${email}", "${gender}");`;
      await db.run(createUserQuery);
      response.send({successMsg: "User created successfully"});
  } else {
    response.status(400);
    response.send({err_msg: "User already exists"});
  }
});

// Login User
app.post('/login', async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send({err_msg: "Invalid user"});
  } else {
    // Compoare hashed password
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    // if password match uniqe jwt token sended
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send({err_msg: "Invalid password"});
    }
  }
})

// Accesing JwtToken
// const authHeader = request.headers['authorization']
app.get("/users", checkAuthentication, async (request, response) => {
     const getUsersQuery = `SELECT * FROM user;`
     const usersArray = await db.all(getUsersQuery);
     response.send(usersArray)
})

// change name user
app.put('/change-username', checkAuthentication, async(request, response) => {
    const {email, password, newName} = request.body
    const emailQuery = `SELECT * FROM user WHERE email="${email}";`
    const existEmail = await db.get(emailQuery);
    if (existEmail !== undefined) {
      const isPasswordMatched = await bcrypt.compare(password, existEmail.password);
      if (isPasswordMatched) {
        const updateUsernameQuery = `UPDATE user SET username="${newName}" WHERE email="${email}"`;
        await db.run(updateUsernameQuery)
        
        response.send({successMsg:"Username updated Successfully"});
      } else {
        response.status(400)
        response.send({err_msg: "Invalid Password"})
      }
    } else {
      response.status(400)
      response.send({err_msg: "Email is not exist"})
    }
})

// change user Password 
app.put('/change-password', checkAuthentication, async(request, response) => {
  const {username, email, newPassword} = request.body
  const dbUserQuery = `SELECT * FROM user WHERE username="${username}";`
  const dbUser = await db.get(dbUserQuery);
  const hashPassword = await bcrypt.hash(newPassword, 10);
  if (dbUser !== undefined) {
    const emailQuery = `SELECT * FROM user WHERE email="${email}";`
    const emailExist = await db.get(emailQuery)
    if (emailExist !== undefined) {
      const updateUsernameQuery = `UPDATE user SET password="${hashPassword}" WHERE email="${email}"`;
      await db.run(updateUsernameQuery)
      
      response.send({successMsg: "Password updated Successfully"});
    } else {
      response.status(400)
      response.send({err_msg: "Email is not exist"})
    }
  } else {
    response.status(400)
    response.send({err_msg: "Invalid User"})
  }
})

// change Email user
app.put('/change-email', checkAuthentication, async(request, response) => {
  const {username, password, newEmail} = request.body
  const dbUserQuery = `SELECT * FROM user WHERE username="${username}";`
  const dbUser = await db.get(dbUserQuery);
  if (dbUser !== undefined) {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const updateUsernameQuery = `UPDATE user SET email="${newEmail}" WHERE username="${username}"`;
      await db.run(updateUsernameQuery)
     
      response.send({successMsg: "Email updated Successfully"});
    } else {
      response.status(400)
      response.send({err_msg: "Inavalid Password"})
    }
    
  } else {
    response.status(400)
    response.send({err_msg: "Inavalid User"})
  }
})


app.delete("/users", checkAuthentication, async(request, response) => {
  const {username} = request.body
  const deleteUserQuery = `DELETE FROM user WHERE username="${username}";`
  await db.run(deleteUserQuery)
  response.send({successMsg: 'Delete user successfully'})
})

// add Children Table 
app.post('/children', checkAuthentication, async(request, response) => {
  const {name, gender} = request.body 
  const existChildrenQuery = `SELECT * FROM children WHERE name="${name}";`
  const existChildren = await db.get(existChildrenQuery);
  const addChildrenQuery = `INSERT INTO children(name, gender) VALUES("${name}", "${gender}");`;
  if (existChildren === undefined) {
    await db.run(addChildrenQuery);
   
    response.send({successMsg: "Add child successfully"});
  } else {
    response.status(400);   
    response.send({
      err_msg: 'Child name already exist',
    })
  }
})

// Delete Children 
app.delete('/children', checkAuthentication, async (request, response) => {
   const {name} = request.body 
   const deleteChild = `DELETE FROM children WHERE name="${name}";`
   const idQuery = `SELECT id FROM children WHERE name="${name}"`
   const childId = await db.get(idQuery)
   const deleteAttendanceQuery = `DELETE FROM Attendance WHERE childId=${childId.id};`
   await db.run(deleteChild);
   await db.run(deleteAttendanceQuery)
   response.send({successMsg: 'Delete child succesfully'})
})
// example
// {
//   "previousName": "NAGACHAITANYA PAMU",
//   "newName": "NAGA CHAITANYA PAMU",
//   "gender": "MALE"
// }
app.put('/children', checkAuthentication, async (request, response) => {
  const {previousName, newName, gender} = request.body
  const checkPreviousNameQuery = `SELECT * FROM children WHERE name="${previousName}";`;
  const existChilldren = await db.get(checkPreviousNameQuery)
  console.log(previousName, newName, gender)
  if (existChilldren === undefined) {
    response.status(400)
    response.send({err_msg: "your previous name is not exist"})
  } else {
    const updateQuery = `UPDATE children SET name='${newName}', gender='${gender}' WHERE name='${previousName}';`
    await db.run(updateQuery)
    response.send({successMsg: "Child updated successfully"})
  }
})

// Get All Childrens data 
app.get('/children', async(request, response) => {
  const getQuery = `SELECT * FROM children ORDER BY name;`
  const childrenArray = await db.all(getQuery);
  response.send(childrenArray);
})

// Attendance to children YYYY-MM-DD
app.post('/attendance', checkAuthentication, async(request, response) => {
      const {array} = request.body
      array.map(async item => {
        const {childId, date, present} = item
        const getDateStatusChild = `SELECT * FROM Attendance WHERE childId=${childId} AND date='${date}';`
        const childrenStatus = await db.get(getDateStatusChild);
        if (childrenStatus === undefined) {
          // Add Children Status
          const addAttendanceQuery = `INSERT INTO Attendance(childId, date, present) VALUES(${childId}, "${date}", ${present});`;
          await db.run(addAttendanceQuery)
          
        } else {
          // UpDate Children Status
          const statusUPdateQuery = `UPDATE Attendance
          SET present=${present}
          WHERE childId=${childId} and date="${date}";`
          await db.run(statusUPdateQuery)
        }
      })
      response.send({successMsg: "Attendance submitted successfully"})
      // const currentDate = new Date() 
      
      // const fromatteddate = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;
      // const sendDate = date.split('-')
      // // const checkCurrentDate = fromatteddate.split("-")[2] === `${parseInt(sendDate[2])}`
      // // const checkYear = fromatteddate.split('-')[0] === sendDate[0]
      // // const checkMonth = fromatteddate.split('-')[1] === `${parseInt(sendDate[1])}`
      
      
      // // if current Date
      
})

// GET ALL STUDENTS ATTENDANCE DETAILS 
app.get("/attendance-details", async (request, response) => {
  const getAttendanceQuery =  `SELECT children.name, SUM(CASE WHEN Attendance.present = 1 THEN 1 ELSE 0 END) AS presents FROM children LEFT JOIN
  Attendance ON children.id = attendance.childId GROUP BY children.name;`
  const attendanceDetailsArray = await db.all(getAttendanceQuery);
  response.send(attendanceDetailsArray);
})

app.delete("/attendance", checkAuthentication, async(request, response) => {
     const {date} = request.body 
     const dateExistQuery = `SELECT DISTINCT date FROM Attendance WHERE date="${date}";`
     const dateExist = await db.get(dateExistQuery)
     if (dateExist !== undefined) {
               const deleteDataAttendanceQuery = `DELETE FROM Attendance WHERE date='${date}';`
               await db.run(deleteDataAttendanceQuery)
               response.send({successMsg: 'Attendance deleted successfully'})
     } else {
      response.status(400)
      response.send({err_msg: 'Date does not exist'})
     }
})

// get useDetails 
app.post("/user-details", async (request, response) => {
  const {username} = request.body
  const getUserDetailsQuery = `SELECT username, email, gender FROM user WHERE username='${username}';`
  const userDetails = await db.get(getUserDetailsQuery)
  response.send(userDetails)
})

// Get specific Date Attendance details QUERY
app.post('/date-attendance', async (request, response) => {
  const {date} = request.body
  const dateViceAttendanceQuery = `SELECT children.name, Attendance.present  AS presents FROM children INNER JOIN
  Attendance ON children.id = attendance.childId WHERE Attendance.date = "${date}" ORDER BY children.name ASC;`
  const dateViceAttendanceArray = await db.all(dateViceAttendanceQuery)
  response.send(dateViceAttendanceArray)
})

// get distinct dates from Attendance Table 
app.get('/attendance-dates', async (request, response) => {
  const getExistDatesQury = `SELECT DISTINCT date FROM Attendance;`
  const existDates = await db.all(getExistDatesQury)
  response.send(existDates);
})


module.exports = app;

const Childrens = [
  {"name": "RISHI CHELLE", "gender": "MALE"}, 
  {"name": "MOJESH CHELLE", "gender": "MALE"}, 
  {"name": "HARSHA VARDHAN", "gender": "MALE"}, 
  {"name": "JOSHNA CHELLE", "gender": "FEMALE"}, 
  {"name": "UDAY KRISHNA KURMA", "gender": "MALE"}, 
  {"name": "SRINIVAS KURMA", "gender": "MALE"}, 
  {"name": "PRAVEEN KUMAR PALLI", "gender": "MALE"},
  {"name": "RAVISAGAR NEPA", "gender": "MALE"}, 
  {"name": "HANI MADHABATHULA", "gender": "FEMALE"},
  {"name": "ADYA MADHABATHULA", "gender": "FEMALE"},
  {"name": "SANTHOSH DHANAM", "gender": "MALE"}
]
const Attendance = [
  {"childId": 1, "date": "2024-02-18",  "present": true}, 
  {"childId": 2, "date": "2024-02-18",  "present": true}, 
  {"childId": 3, "date": "2024-02-18",  "present": true}, 
  {"childId": 4, "date": "2024-02-18",  "present": true}, 
  {"childId": 5, "date": "2024-02-18",  "present": true}, 
  {"childId": 6, "date": "2024-02-18",  "present": true}, 
  {"childId": 7, "date": "2024-02-18",  "present": true},
  {"childId": 8, "date": "2024-02-18",  "present": true}, 
  {"childId": 9, "date": "2024-02-18",  "present": false},
  {"childId": 10, "date": "2024-02-18",  "present": false},
  {"childId": 11, "date": "2024-02-18",  "present": true},
  {"childId": 12, "date": "2024-02-18",  "present": false}
]
// Get All children ATTENDANCE DETAILS QUERY
// SELECT children.name, SUM(CASE WHEN Attendance.present = 1 THEN 1 ELSE 0 END) AS attendance FROM children INNER JOIN
//  Attendance ON children.id = attendance.childId GROUP BY children.name;





// Day find to date
// var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
//   var d = new Date(date string fromat);
//   var dayName = days[d.getDay()];
//   console.log(dayName)