
//function based
import React, { useEffect, useReducer, useState } from 'react'
import { StyleSheet, Text, View, Button } from 'react-native';
//amplify related imports
import API, { graphqlOperation } from '@aws-amplify/api'
import  Storage  from '@aws-amplify/storage'
import Amplify from '@aws-amplify/core';
import Auth from '@aws-amplify/auth';
import { Hub } from '@aws-amplify/core';
import PubSub from '@aws-amplify/pubsub';
import { withAuthenticator } from 'aws-amplify-react-native';
import { Connect } from 'aws-amplify-react-native';
//config file for configuring amplify modules
import config from './aws-exports'

import {v4 as uuid} from 'uuid';

//queries and mutation functions auto generted by amplify for schema
import { createAlbum } from './src/graphql/mutations';
import { deleteAlbum } from './src/graphql/mutations';
import { onCreateAlbum } from './src/graphql/subscriptions';
import { listAlbums } from './src/graphql/queries';


import { Component } from 'react';
import { TextInput } from 'react-native';

//for selecting image.
import ImagePicker from 'react-native-image-picker';

//don't care about this warning.


// options for imagepicker
const options = {
  title: 'Select Avatar',
  customButtons: [{ name: 'fb', title: 'Choose Photo from Facebook' }],
  storageOptions: {
    skipBackup: true,
    path: 'images',
  },
};

//Amplify.configure(config)
API.configure(config)             // Configure Amplify
PubSub.configure(config)
Auth.configure(config)
Storage.configure(config)
//Storage.configure()


//#######SIGN OUT SECTION IF YOU WANT TO MANUALLY ADD##############
// signout

//Auth.signOut()
//    .then(data => console.log(data))
//    .catch(err => console.log(err));

// By doing this, you are revoking all the auth tokens(id token, access token and refresh token)
// which means the user is signed out from all the devices
// Note: although the tokens are revoked, the AWS credentials will remain valid until they expire (which by default is 1 hour)

//Auth.signOut({ global: true })
//    .then(data => console.log(data))
//    .catch(err => console.log(err));
//###############################


const QUERY = 'QUERY';
const SUBSCRIPTION = 'SUBSCRIPTION';

const initialState = {
  albums: [],
  imageSelection:[]
};

const initialSearch ="test";

const reducer = (state, action) => {
    //as subscriptions or queries are performed, state will be updated with
    //album  json items. you can see their auto generated IDs in the log output.
    console.log(" in reducer. current state:")
    console.log(JSON.stringify(state))

  switch (action.type) {
    case QUERY:
      return {...state, albums: action.albums};
    case SUBSCRIPTION:
      return {...state, albums:[...state.albums, action.album]}
    case SELECTIMAGE:
       return {...state, imageSelection:action.source}
    default:
      return state
  }
}


async function createNewAlbum() {
  const album = { name: "dengue tests" }
  //could manually set IDs using something like
  //const album = { name: "dengue tests",ID:12345 }
  await API.graphql(graphqlOperation(createAlbum, { input: album }))
}



// an example of syntax for querying database item by paramaters.
// graphql full schema can be accessed by <using amplify console api> in terminal
// model inputs allow for conditions such as contains, eq, ne, contains,
// between, beginswith etc.
async function queryByID() {
  //for id
  //const myfilter = { filter: {id:{contains:123}}}
  //for owner
  const myfilter = { filter: {owner:{contains:"InbiosBot"}}}
  const albumData = await API.graphql(graphqlOperation(listAlbums, myfilter))
  console.log(JSON.stringify(albumData))
}



function App() {
    //these are react hook state vairables, as well as the functions that modify them
    const [state, dispatch] = useReducer(reducer, initialState)
    const [myPicture, setMyPicture] = useState({mypicture:"none"})

    //grabs a picture and attaches it to state
    async function postImageS3(){
      console.log("currently selected picture is")
      console.log(JSON.stringify(myPicture))
      console.log("my filename is")
      console.log(JSON.stringify(myPicture.fileName))
      console.log("my data is")
      console.log(JSON.stringify(myPicture.data))

      const result = await Storage.put(
           //react hook constants can be used directly without this.
            myPicture.fileName,
            myPicture.data,
            {
              customPrefix: { public: 'uploads/' },
              //attaching metadata which will be later used to bind this image
              //to our dynamodb
              //metadata: { albumid: this.props.albumId }
              metadata:{albumid:"some custom meta data"}
            }
          );
          //a key returned to use by AWS letting us know all went according to plan
          console.log('Uploaded file: ', result);
    }

    //function using imagepicker to grab an image from the device and assign
    //it to our myPicture state variable using its dedicated setter setMyPicture()
    //it would be trivial to assign an array of images using another method.
    //unfortunately image picker doesn't support multiple selection.
    async function grabPicture() {
      ImagePicker.showImagePicker(options, (response) => {
        console.log('Response = ', response);
        if (response.didCancel) {
          console.log('User cancelled image picker');
        } else if (response.error) {
          console.log('ImagePicker Error: ', response.error);
        } else if (response.customButton) {
          console.log('User tapped custom button: ', response.customButton);
        } else {
          const source = { uri: response.uri };
          const newName = uuid() + ".jpg"
          response.fileName = newName
          setMyPicture(response)
          return(response)
        }
      });
    }

    //useEffect listener for queries and subscriptions to dynamoDB
    useEffect(() => {
        async function getData() {
            //lists all albums in dynamodb (no filter)
            console.log("in get data")
            const myData = await API.graphql(graphqlOperation(listAlbums))
            //dispatches to reducer which handles state. adjusts state based on whether
            // action type is query or subscription
            dispatch({ type: QUERY, albums: myData.data.listAlbums.items });
        }
        getData();

        // only runs this part during event data? what generates event data?
        const subscription = API.graphql(graphqlOperation(onCreateAlbum)).subscribe({
          next: (eventData) => {
            console.log("grabbing current state")
              console.log(JSON.stringify(state))
            const album = eventData.value.data.onCreateAlbum;
            dispatch({ type: SUBSCRIPTION, album })
          }
        });
        //specify how to clean up after to avoid memory leak
        return () => subscription.unsubscribe()
        //DO NOT REMOVE THIS '[]' . causes recursive posting. This section is admittedly witchcraft to me.
    }, []);

    //you can use multiple useEffects. with the [myPicture] argument at
    //the bottom, this useEffect will only run when myPicture is changed
    //We will use these listeners to bind our graphql mutations
    //automatically generate s3 Storage.puts
    //const [count, sumCount] = useState(0)

    useEffect(() => {
      console.log("myPicture has changed")
      console.log(JSON.stringify(myPicture))
    },[myPicture]);


//example button for changing react hook values directly from button
//<Button onPress={() => sumCount(count + 1)} title = "increment" />
    return (
      <View style={styles.container}>

        <Button onPress={createNewAlbum} title='Create Album' />
        { state.albums.map((album, i) => <Text key={album.id}>{album.name} : {album.owner}</Text>) }

        <Button onPress={grabPicture} title='Select Picture' />

        <Button onPress={postImageS3} title = "post picture" />
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
export default withAuthenticator(App,{includeGreetings:true})
