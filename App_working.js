import React, { useEffect, useReducer } from 'react'
import { StyleSheet, Text, View, Button } from 'react-native';
import API, { graphqlOperation } from '@aws-amplify/api'
import PubSub from '@aws-amplify/pubsub';
import { createAlbum } from './src/graphql/mutations';
import { deleteAlbum } from './src/graphql/mutations';
import { onCreateAlbum } from './src/graphql/subscriptions';
import { listAlbums } from './src/graphql/queries';
import config from './aws-exports'
import { withAuthenticator } from 'aws-amplify-react-native';
import Amplify from '@aws-amplify/core';
import Auth from '@aws-amplify/auth';
import { Hub } from '@aws-amplify/core';
Amplify.configure(config)
API.configure(config)             // Configure Amplify
PubSub.configure(config)


Auth.signOut()
    .then(data => console.log(data))
    .catch(err => console.log(err));

// By doing this, you are revoking all the auth tokens(id token, access token and refresh token)
// which means the user is signed out from all the devices
// Note: although the tokens are revoked, the AWS credentials will remain valid until they expire (which by default is 1 hour)
Auth.signOut({ global: true })
    .then(data => console.log(data))
    .catch(err => console.log(err));









const QUERY = 'QUERY';
const SUBSCRIPTION = 'SUBSCRIPTION';

const initialState = {
  todos: [],
};

const reducer = (state, action) => {
  switch (action.type) {
    case QUERY:
      return {...state, todos: action.todos};
    case SUBSCRIPTION:
      return {...state, todos:[...state.todos, action.todo]}
    default:
      return state
  }
}

async function createNewTodo() {
  const todo = { name: "fancy new album", owner: "Schmitty" }
  await API.graphql(graphqlOperation(createAlbum, { input: todo }))
}

async function queryByID() {
  const myfilter = { filter: {id:{contains:123}}}
  const todoData = await API.graphql(graphqlOperation(listAlbums, myfilter))
  console.log(JSON.stringify(todoData))
}

function App() {
    const [state, dispatch] = useReducer(reducer, initialState)

    useEffect(() => {
      async function getData() {
        const myData = await API.graphql(graphqlOperation(listAlbums))
        dispatch({ type: QUERY, todos: myData.data.listAlbums.items });
      }
      getData();

      const subscription = API.graphql(graphqlOperation(onCreateAlbum)).subscribe({
        next: (eventData) => {
          const todo = eventData.value.data.onCreateAlbum;
          dispatch({ type: SUBSCRIPTION, todo })
        }
      });

      return () => subscription.unsubscribe()
    }, []);


    //Button has onPress which calls createNewTodo, an asynchronous function
    // that utilizes an imported graphql operation createTodo.
    // api uses the format
    //API.graphql(graphqlOperation(Createoperation, { input: <dictionary> }))



    return (
      <View style={styles.container}>
        <Button onPress={createNewTodo} title='Create Todo' />
        { state.todos.map((todo, i) => <Text key={todo.id}>{todo.name} : {todo.owner}</Text>) }
        <Button onPress={queryByID} title='querytodo' />
      </View>


    );
}

const styles = StyleSheet.create({
   container: {
     backgroundColor: '#ddeeff',
     alignItems: 'center',
     justifyContent: 'center',
     flex: 1
   }
 });
export default withAuthenticator(App)
