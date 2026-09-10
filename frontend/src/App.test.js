import { render, screen } from '@testing-library/react';
import App from './App';
import React from 'react'

function login() {
  return (
    <div className='d-flex justify-content-center align-items-center bg-primary vh-100  '>
        <div className='bg-white p-3 rounded w-25'>
            <form action=''>
                <div className='mb-3'>
                    <label htmlFor='email'>Email</label>
                    <input type='email' placeholder='Enter Email'/>
                </div>
                <div className='mb-3'>
                    <label htmlFor='password'>Password</label>
                    <input type='password' placeholder='Enter Password'/>
                </div>
                <button className='btn btn-success'>Login</button>
                <p>You agree to out term and policies</p>
                <button className='btn btn-default border'>Create Account</button>
            </form>
        </div> 
    </div>
  )
}

export default login