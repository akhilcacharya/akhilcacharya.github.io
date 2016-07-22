---
published: false
---
Since buying Amazon Prime a few months ago I've been entranced by the video player's "X-Ray" feature, which presents an overlay of actors and contextual information relevant to the current scene. While this feature isn't Prime specific - Google Play Movies/TV has a similar feature - I've been interested in having a similar system for arbitrary web videos.  

Now, I'm aware that the Amazon's system was likely built by partial or complete manual tagging system, but lets consider a realtime system that can output the names of individuals in a particular still frame of a video image. To do this, there must be a way to extract the faces of individuals in a scene and recognize them individually. 

## Data

For an X-Ray like application, it’s easy to find relevant base images to train a simple classifier. I decided to use the [Microsoft Celebrity Dataset](https://www.microsoft.com/en-us/research/project/msra-cfw-data-set-of-celebrity-faces-on-the-web/), a 1.3 gigabyte archive containing named folders and a series of face images.  The archive also comes with surprisingly full-featured metadata, including LBP data for possible future projects :) 


## Face Extraction

To detect a face in an image, I used the [Viola-Jones Object Detection Framework](https://www.cs.cmu.edu/~efros/courses/LBMV07/Papers/viola-cvpr-01.pdf), or a Haar Cascade Classifier in OpenCV. 

The classifier works through a "cascade" of sliding window comparisons across the image to be compared. Each region is compared against a pre-existing [Haar-like feature](https://en.wikipedia.org/wiki/Haar-like_features), or a previously computed region of the image that characterizes the target class. Specifically, these features depend on several assumptions of essential characteristics of human faces, such as the fact that certain regions will consistently be darker and close to others. If a sample feature is close enough to the target feature, the algorithm continues the process for a smaller sub-region until a positive classification cannot be ruled out. 

These previously computed features are generally stored in XML files, where they exist as a set of rectangle definitions that yield positive binary classification. One such XML file can be found in the OpenCV installation for frontal face features.

Utilizing the Haar Classifier is straightforward: 

```python 
import cv2
CASCADE_XML = "haarcascade_frontalface_default.xml"
# Initialize cascade classifier
face_cascade = cv2.CascadeClassifier(CASCADE_XML)
def extract_face(img_path):
    # Grab color and grayscale 
    img = cv2.imread(img_path)
    grayscale = cv2.imread(img_path, 0)

    # Grab an array of one face in the image
    # (Assume each image has 1 face only)
    faces = face_cascade.detectMultiScale(
        grayscale,           
        scaleFactor=1.5,
        minNeighbors=1,  
        minSize=(10, 10),
        flags = 0
    )

    if len(faces) != 1:
        return numpy.asarray([])

    (x, y, w, h) = faces[0]

    # Crop the image to 30, 30 face
    cv2.rectangle(img, (x, y), (x+w, y+h), (0, 255, 0), 2)
   
    cropped = img[y:y+h, x:x+w]

    # Scale to 50x50 for consistency 
    resized = cv2.resize(cropped, (50, 50), interpolation=cv2.INTER_AREA)

    # Return image as nparray if single face, or None if multiple

    result = numpy.asarray(resized)

    return result
```


## Face Recognition

There are a handful of straightforward facial recognition systems built into OpenCV, including Fisherface and Eigenface. I decided to go with Eigenfaces for simplicity - the API works by accepting image vectors with labels. 

Since this is just a demo, I wrote a function to train faces on the Eigenface recognizer given an array of face tuples. I included code divide the current dataset into train and test subsets and test the accuracy of the system in the same function. 

```python 
recognizer = cv2.createEigenFaceRecognizer()
def train_faces(face_tuples):
    # Decompose tuple list into arrays of images (X) & arrays of labels (Y)
    X = []
    Y = []
     
    unique_labels = {}

    for t in face_tuples:
        X.append(t[0])
        unique_labels[t[1]] = True

    for t in face_tuples:
        #Set label vector
        Y.append(unique_labels.keys().index(t[1]))
 
   # Split X and Y into train and test
    X_train = X[:int(len(X) * 0.7)]
    X_test = X[int(len(X) * 0.7):]

    Y_train = Y[:int(len(Y) * 0.7)]
    Y_test = Y[int(len(Y) * 0.7):]

    print "Training Dataset"

    recognizer.train(numpy.asarray(X_train), numpy.asarray(Y_train))

    print "Testing Dataset"
    idx = 0
    for img in X_test:
        predict, conf = recognizer.predict(img)
        # Print the accuracy of the run
        print "Actual: %s, Predict: %s, Conf: %f" % (unique_labels.keys()[Y_test[idx]], unique_labels.keys()[predict], conf)
        idx = idx + 1
```

I tested my initial implementation with an abbreviated version of the Microsoft dataset with 10 classes, and got a roughly 50% accuracy rate. This isn’t great, but it is 5x the random-chance baseline. 

Next, I’d like to swap out the Eigenface classification with a more robust CNN to hopefully get the accuracy up to the 70’s or 80s. 

Stay tuned! Full source may be found [here](https://github.com/akhilcacharya/YRay). 

