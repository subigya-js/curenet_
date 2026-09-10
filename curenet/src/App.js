import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Login from './login'; 
import Signup from './signup'; 
import Dashboard from './dashboard'; 
import Chatbot from './chatbot';
import Selection from './selection';
import Doclogin from './doclogin';
import Docsignup from './docsignup';
import Admin from './admin';
import Docdashboard from './docdashboard';
import Admindashboard from './admindashboard';
import Scheduleappointment from './scheduleappointment';
import Virtualappointment from './virtualappointment';
import Laboratory from './laboratory';
import Viewtextappointment from './viewtextappointment';
import Medication from './medication';
import Viewvirtualappointment from './viewvirtualappointment';
import Viewpatienthistory from './viewpatienthistory';
import Adminadddoctor from './adminadddoctor';
import Viewtables from './viewtables';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Selection />} />
        <Route path='/login' element={<Login />} />
        <Route path='/doclogin' element={<Doclogin />} />
        <Route path='/signup' element={<Signup />} />
        <Route path='/docsignup' element={<Docsignup />} />
        <Route path='/admin' element={<Admin />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/docdashboard" element={<Docdashboard />} />
        <Route path="/admindashboard" element={<Admindashboard />} />
        <Route path="/chatbot" element={<Chatbot />} /> 
        <Route path="/schedule" element={<Scheduleappointment />} /> 
        <Route path="/schedulevirtual" element={<Virtualappointment />} /> 
        <Route path="/laboratory" element={<Laboratory />} /> 
        <Route path="/viewappointment" element={<Viewtextappointment />} /> 
        <Route path="/viewvirtualappointment" element={<Viewvirtualappointment />} /> 
        <Route path="/medication/:a_id" element={<Medication />} />
        <Route path="/viewhistory" element={<Viewpatienthistory />} /> 
        <Route path="/adminadddoctor" element={<Adminadddoctor />} /> 
        <Route path="/viewtables" element={<Viewtables />} /> 
        
      </Routes>
    </BrowserRouter>
  );
}

export default App;
