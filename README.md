# Incarnate [![Build Status](https://travis-ci.org/resistdesign/incarnate.svg?branch=master)](https://travis-ci.org/resistdesign/incarnate)

Runtime Dependency Lifecycle Management for JavaScript.

## Install

`npm i -S incarnate`

## API Docs

http://incarnate.resist.design

## Usage Example

```jsx
import Incarnate from 'incarnate';

// Declare your application dependencies.
const inc = new Incarnate({
  subMap: {
    // Keep track of your state.
    state: {
      subMap: {
        user: {
          factory: () => ({
            authToken: undefined
          })
        }
      }
    },
    // Supply some services.
    services: {
      // Some services need authorization information.
      shared: {
        user: 'state.user'
      },
      subMap: {
        user: true,
        login: {
          factory: () => {
            return async (username, password) => {
              // Make a login request, get the `authToken`.
              const fakeToken = `${username}:${password}`;

              // For demo purposes we'll use the `Buffer` API in node.js to base64 encode the credentials.
              return Buffer.from(fakeToken).toString('base64');
            };
          }
        },
        accounts: {
          dependencies: {
            user: 'user'
          },
          factory: ({dependencies: {user: {authToken = ''} = {}} = {}} = {}) => {
            return async () => {
              // NOTE: IF we call this service method AFTER `login`,
              // the `authToken` will have been automatically updated,
              // in this service, by Incarnate.
              if (!authToken) {
                throw new Error('The accounts service requires an authorization token but one was not supplied.');
              }

              // Get a list of accounts with the `authToken` in the headers.
              console.log('Getting accounts with headers:', {
                Authorization: `Bearer: ${authToken}`
              });

              return [
                {name: 'Account 1'},
                {name: 'Account 2'},
                {name: 'Account 3'},
                {name: 'Account 4'}
              ];
            };
          }
        }
      }
    },
    // Expose some actions that call services and store the results in a nice, tidy, reproducible way.
    actions: {
      shared: {
        user: 'state.user',
        loginService: 'services.login'
      },
      subMap: {
        user: true,
        loginService: true,
        login: {
          dependencies: {
            loginService: 'loginService'
          },
          setters: {
            setUser: 'user'
          },
          factory: ({dependencies: {loginService} = {}, setters: {setUser} = {}} = {}) => {
            return async ({username, password} = {}) => {
              // Login
              const authToken = await loginService(username, password);

              // Store the `authToken`.
              setUser({
                authToken
              });

              return true;
            };
          }
        }
      }
    }
  }
});

// Here's your app.
export default async function app() {
  // Get the Login Action.
  const loginAction = inc.getResolvedPath('actions.login');
  // Do the login.
  const loginResult = await loginAction({
    username: 'TestUser',
    password: 'StopTryingToReadThis'
  });
  // Get the Accounts Service. It needs the User's `authToken`,
  // but you declared it as a Dependency,
  // so Incarnate took care of that for you.
  const accountsService = inc.getResolvedPath('services.accounts');
  // Get those accounts you've been dying to see...
  const accounts = await accountsService();

  // Here they are!
  console.log('These are the accounts:', accounts);
}

// You need to run your app.
app();
```

## License

[MIT](LICENSE.txt)
