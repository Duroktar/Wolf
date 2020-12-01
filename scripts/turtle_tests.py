import turtle


def up():
    print('UP')
    turtle.setheading(90)
    turtle.forward(100)

def down():
    print('DOWN')
    turtle.setheading(270)
    turtle.forward(100)

def left():
    print('LEFT')
    turtle.setheading(180)
    turtle.forward(100)

def right():
    print('RIGHT')
    turtle.setheading(0)
    turtle.forward(100)


turtle.onkey(up, "Up")
turtle.onkey(down, "Down")
turtle.onkey(left, "Left")
turtle.onkey(right, "Right")


turtle.shape("turtle")

turtle.listen()

turtle.exitonclick()
