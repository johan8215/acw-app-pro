/*********************************************************
 *  ALLSTON CAR WASH – ACW-App v4.3 Red Glass Edition
 *  Clean Reset Build | Author: JAG15 & Sky
 *********************************************************/

window.addEventListener("load", async () => {
  // Splash timeout
  setTimeout(() => {
    const s = document.getElementById("splash");
    if (s) s.style.display = "none";
  }, 2500);

  const savedEmail = localStorage.getItem("acw_email");
  if (savedEmail) {
    document.getElementById("login").style.display = "none";
    document.getElementById("welcome").style.display = "block";
    document.getElementById("userName").textContent = savedEmail.split("@")[0];
    document.getElementById("userRole").textContent = "Manager";
    await getSchedule(savedEmail);
  }
});

async function loginUser() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) return alert("Enter your credentials");

  localStorage.setItem("acw_email", email);
  document.getElementById("login").style.display = "none";
  document.getElementById("welcome").style.display = "block";
  document.getElementById("userName").textContent = email.split("@")[0];
  document.getElementById("userRole").textContent = "Manager";
  await getSchedule(email);
  document.getElementById("teamOverviewBtn").style.display = "block";
}

/* Schedule */
async function getSchedule(email) {
  const week = "Oct 20 – Oct 26, 2025";
  const name = "J. Giraldo";
  const days = [
    { name: "Mon", shift: "7:30 - 3", hours: 7.5 },
    { name: "Tue", shift: "8:00 - 4", hours: 8 },
    { name: "Wed", shift: "7:30 - 3", hours: 7.5 },
    { name: "Thu", shift: "OFF", hours: 0 },
    { name: "Fri", shift: "7:30 - 3", hours: 7.5 }
  ];

  let html = `<div class='week-header'><h3>Week of ${week}</h3><p><b>${name}</b></p></div>`;
  html += `<table class='schedule-table'><thead><tr><th>Day</th><th>Shift</th><th>Hours</th></tr></thead><tbody>`;
  days.forEach(d => html += `<tr><td>${d.name}</td><td>${d.shift}</td><td>${d.hours}</td></tr>`);
  html += `</tbody></table><p class='total'>Total Hours: <b>30.5</b></p>`;
  document.getElementById("schedule").innerHTML = html;
}

/* Team Overview */
function openTeamOverview() {
  document.getElementById("teamModal").style.display = "flex";
  const team = [
    { name: "Wendy", phone: "(617) 254-3210", shift: "7:30 - 3", hours: 7.5 },
    { name: "Carlos", phone: "(617) 555-1234", shift: "8:00 - 4", hours: 8.0 },
    { name: "Luis", phone: "(617) 444-3322", shift: "OFF", hours: 0.0 }
  ];
  let html = `<table><thead><tr><th>Name</th><th>Phone</th><th>Shift</th><th>Hours</th><th></th></tr></thead><tbody>`;
  team.forEach(e=>{
    html += `<tr><td>${e.name}</td><td>${e.phone}</td><td>${e.shift}</td><td>${e.hours}</td>
             <td><button onclick='openEmployee(${JSON.stringify(e)})'>Open</button></td></tr>`;
  });
  html += `</tbody></table>`;
  document.getElementById("teamTable").innerHTML = html;
}
function closeTeamOverview(){ document.getElementById("teamModal").style.display = "none"; }

/* Employee Modal */
function openEmployee(emp){
  document.getElementById("employeeModal").style.display = "flex";
  document.getElementById("empName").textContent = emp.name;
  document.getElementById("empPhone").textContent = "Phone: " + emp.phone;
  const table = `<table class='schedule-table'>
  <tr><th>Shift</th><th>Hours</th></tr>
  <tr><td>${emp.shift}</td><td>${emp.hours}</td></tr></table>`;
  document.getElementById("empSchedule").innerHTML = table;
}
function closeEmployeeModal(){ document.getElementById("employeeModal").style.display = "none"; }

/* Settings */
function openSettings(){ document.getElementById("settingsModal").style.display = "flex"; }
function closeSettings(){ document.getElementById("settingsModal").style.display = "none"; }

/* Logout */
function logoutUser(){ localStorage.removeItem("acw_email"); location.reload(); }

/* Dummy message */
async function sendEmpMessage(){
  alert("Message sent successfully!");
}
