# objtrans
### transform a javascript object
similar to [js-object-transform](https://github.com/storjarn/js-object-transform) but works a bit differently  
  
  
install with  
`npm install --save objtrans`  
or  
`bower install --save objtrans`

##example
```coffeescript
user =
  name: 'jimmy'
  emails: [
    'jam@jam.com'
    'jef@jef.com'
    'zam@zam.com'
  ]
  local:
    email: 'jim@jim.com'
    password: '23goh32fgdf'
  firstname: 'Jim'
  horrible:
    obj:
      surname: 'Smith'
    
pattern = 
  nameDetails:
    name: true
    username: 'name'
  email: 'emails[first]'
  firstname: (input) ->
    if input
      input.toUpperCase()
  lastname: ['horrible.obj.surname', (input) ->
    if input
      input.toLowerCase()
  ]
  details:
    fullname: (input) ->
      input.firstname + ' ' + input.horrible.obj.surname
      
newUser = objtrans user, pattern

console.log newUser

###
{
  "nameDetails": {
    "name": "jimmy",
    "username": "jimmy"
  },
  "email": "jam@jam.com",
  "firstname": "JIM",
  "lastname": "smith",
  "details": {
    "fullname": "Jim Smith"
  }
}
###

```